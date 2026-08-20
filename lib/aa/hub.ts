import { isOpenWeight } from "./filter"
import { officialUrlForHfId, type HfMapping } from "./hf-ids"
import {
  expectedHfAuthors,
  guessHfMappings,
  hfSearchQuery,
  mappingFromHubCache,
  pickHfSearchHit,
  resolveHfMapping,
} from "./hf-resolve"
import { readHubSnapshot, writeHubSnapshot } from "./hub-snapshot"
import { readSnapshot } from "./snapshot"
import type { HubDetail, HubSnapshot, HubVramEstimate, ModelNode } from "./types"

export const VLLM_DOCS_URL = "https://docs.vllm.ai/en/stable/cli/serve.html"
export const SGLANG_DOCS_URL = "https://docs.sglang.ai/"

const HF_API_TIMEOUT_MS = 15_000
const HF_CONFIG_TIMEOUT_MS = 8_000
const HF_SEARCH_TIMEOUT_MS = 10_000
const HUB_CONCURRENCY = 4
const VRAM_OVERHEAD = 1.2
const HF_SEARCH_LIMIT = 8

export type HubRefreshErrorCode = "NO_SNAPSHOT" | "MODEL_NOT_FOUND" | "NOT_OPEN" | "UNKNOWN_HUB_ERROR"

export class HubRefreshError extends Error {
  constructor(public code: HubRefreshErrorCode) {
    super(code)
    this.name = "HubRefreshError"
  }
}

export interface HubRefreshStats {
  attempted: number
  updated: number
  unmapped: number
  failed: number
}

export interface HubRefreshResult {
  snapshot: HubSnapshot
  stats: HubRefreshStats
}

interface HfModelInfo {
  id?: string
  pipeline_tag?: string
  tags?: string[]
  gated?: boolean | string
  private?: boolean
  cardData?: {
    license?: string | string[]
    license_name?: string
  }
  safetensors?: {
    total?: number
    parameters?: Record<string, number>
    error?: string
  }
  usedStorage?: number
  siblings?: { rfilename: string; size?: number }[]
}

function hfToken(): string | undefined {
  return process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN || undefined
}

function hfHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "frontier-model-explorer/0.1",
  }
  const token = hfToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function isGatedFlag(value: boolean | string | undefined): boolean {
  return value === true || value === "auto" || value === "manual"
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}

function parameterCountFromInfo(info: HfModelInfo): number | undefined {
  const total = asFiniteNumber(info.safetensors?.total)
  if (total) return total
  const params = info.safetensors?.parameters
  if (!params) return undefined
  let sum = 0
  for (const value of Object.values(params)) {
    if (typeof value === "number" && Number.isFinite(value)) sum += value
  }
  return sum > 0 ? sum : undefined
}

function safetensorsBytesFromInfo(info: HfModelInfo): number | undefined {
  const used = asFiniteNumber(info.usedStorage)
  if (used) return used
  if (!info.siblings) return undefined
  let sum = 0
  for (const sibling of info.siblings) {
    if (!sibling.rfilename.endsWith(".safetensors")) continue
    if (typeof sibling.size === "number" && Number.isFinite(sibling.size)) sum += sibling.size
  }
  return sum > 0 ? sum : undefined
}

function licenseFromInfo(info: HfModelInfo): string | undefined {
  const cardLicense = info.cardData?.license
  if (typeof cardLicense === "string" && cardLicense.trim()) return cardLicense.trim()
  if (Array.isArray(cardLicense)) {
    const first = cardLicense.find((item) => typeof item === "string" && item.trim())
    if (first) return first.trim()
  }
  if (typeof info.cardData?.license_name === "string" && info.cardData.license_name.trim()) {
    return info.cardData.license_name.trim()
  }
  const tag = info.tags?.find((item) => item.startsWith("license:"))
  if (tag) return tag.slice("license:".length)
  return undefined
}

export function estimateVramGb(parameterCount: number): HubVramEstimate {
  const weightGb = (bytesPerParam: number) => (parameterCount * bytesPerParam * VRAM_OVERHEAD) / 1e9
  return {
    fp16: roundGb(weightGb(2)),
    int8: roundGb(weightGb(1)),
    int4: roundGb(weightGb(0.5)),
  }
}

function roundGb(value: number): number {
  if (value >= 100) return Math.round(value)
  if (value >= 10) return Math.round(value * 10) / 10
  return Math.round(value * 100) / 100
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await fn(items[index])
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function errorFromStatus(status: number, timedOut: boolean): string {
  if (timedOut) return "timeout"
  if (status === 401 || status === 403) return "gated"
  if (status === 404) return "not_found"
  if (status === 429) return "rate_limited"
  return "fetch_failed"
}

function errorFromCatch(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout"
  if (error instanceof Error && /timeout|aborted/i.test(error.message)) return "timeout"
  return "fetch_failed"
}

async function fetchJson(url: string, timeoutMs: number): Promise<{ ok: true; json: unknown } | { ok: false; status: number; timedOut: boolean }> {
  try {
    const res = await fetch(url, {
      headers: hfHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { ok: false, status: res.status, timedOut: false }
    return { ok: true, json: await res.json() }
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return { ok: false, status: timedOut ? 0 : 0, timedOut: timedOut || errorFromCatch(error) === "timeout" }
  }
}

async function fetchConfigParameterCount(hfId: string): Promise<number | undefined> {
  const url = `https://huggingface.co/${hfId}/raw/main/config.json`
  try {
    const res = await fetch(url, {
      headers: hfHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(HF_CONFIG_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const json: unknown = await res.json()
    if (!json || typeof json !== "object") return undefined
    const row = json as Record<string, unknown>
    return asFiniteNumber(row.num_parameters) ?? asFiniteNumber(row.n_params)
  } catch {
    return undefined
  }
}

function baseDetail(mapping: HfMapping, fetchedAt: string): HubDetail {
  const serving = {
    vllm: VLLM_DOCS_URL,
    sglang: SGLANG_DOCS_URL,
    ...(mapping.ollama ? { ollama: `https://ollama.com/library/${mapping.ollama}` } : {}),
  }

  return {
    hfId: mapping.hfId,
    modelUrl: `https://huggingface.co/${mapping.hfId}`,
    officialUrl: officialUrlForHfId(mapping.hfId, mapping),
    serving,
    fetchedAt,
  }
}

async function searchHfMapping(model: ModelNode): Promise<HfMapping | undefined> {
  const query = hfSearchQuery(model)
  if (query.length < 3) return undefined

  const authors = expectedHfAuthors(model)
  const params = new URLSearchParams({
    search: query,
    limit: String(HF_SEARCH_LIMIT),
    sort: "downloads",
    direction: "-1",
  })
  if (authors[0]) params.set("author", authors[0])

  const result = await fetchJson(`https://huggingface.co/api/models?${params.toString()}`, HF_SEARCH_TIMEOUT_MS)
  if (!result.ok || !Array.isArray(result.json)) return undefined
  return pickHfSearchHit(model, result.json)
}

async function fetchHubMetadata(mapping: HfMapping, fetchedAt: string): Promise<HubDetail> {
  const detail = baseDetail(mapping, fetchedAt)
  const apiUrl = `https://huggingface.co/api/models/${mapping.hfId}?expand=safetensors,cardData,gguf`
  const result = await fetchJson(apiUrl, HF_API_TIMEOUT_MS)

  if (!result.ok) {
    const error = errorFromStatus(result.status, result.timedOut)
    return {
      ...detail,
      gated: error === "gated" ? true : detail.gated,
      error,
    }
  }

  const info = (result.json ?? {}) as HfModelInfo
  const gated = isGatedFlag(info.gated)
  let parameterCount = parameterCountFromInfo(info)
  if (parameterCount == null) {
    parameterCount = await fetchConfigParameterCount(mapping.hfId)
  }

  const resolvedId = typeof info.id === "string" && info.id ? info.id : mapping.hfId
  const next: HubDetail = {
    ...detail,
    hfId: resolvedId,
    modelUrl: `https://huggingface.co/${resolvedId}`,
    gated,
    pipelineTag: typeof info.pipeline_tag === "string" ? info.pipeline_tag : undefined,
    tags: Array.isArray(info.tags) ? info.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 24) : undefined,
  }

  const license = licenseFromInfo(info)
  if (license) next.license = license
  if (parameterCount != null) {
    next.parameterCount = parameterCount
    next.vramEstimate = estimateVramGb(parameterCount)
  }
  const bytes = safetensorsBytesFromInfo(info)
  if (bytes != null) next.safetensorsBytes = bytes

  if (gated && !hfToken() && parameterCount == null && !license) {
    next.error = "gated"
  }

  return next
}

async function fetchHubDetail(model: ModelNode, existing?: HubDetail): Promise<HubDetail> {
  const fetchedAt = new Date().toISOString()
  const curated = resolveHfMapping(model)
  const cached = curated ? undefined : mappingFromHubCache(existing)
  const guesses = curated ? [] : guessHfMappings(model).filter((row) => row.hfId !== cached?.hfId)
  const toTry = [curated, cached, ...guesses].filter((row): row is HfMapping => row != null)

  let mappedDetail: HubDetail | undefined
  for (const mapping of toTry) {
    mappedDetail = await fetchHubMetadata(mapping, fetchedAt)
    if (mappedDetail.error !== "not_found") return mappedDetail
  }

  const searched = await searchHfMapping(model)
  if (!searched) return mappedDetail ?? { fetchedAt, error: "unmapped" }
  if (toTry.some((row) => row.hfId === searched.hfId)) return mappedDetail ?? { fetchedAt, error: "unmapped" }
  return fetchHubMetadata(searched, fetchedAt)
}

function statsFor(details: HubDetail[]): HubRefreshStats {
  let updated = 0
  let unmapped = 0
  let failed = 0
  for (const detail of details) {
    if (detail.error === "unmapped") unmapped += 1
    else if (detail.error) failed += 1
    else updated += 1
  }
  return { attempted: details.length, updated, unmapped, failed }
}

export async function refreshHubDetails(options?: { modelId?: string }): Promise<HubRefreshResult> {
  const catalog = await readSnapshot()
  if (!catalog || catalog.models.length === 0) {
    throw new HubRefreshError("NO_SNAPSHOT")
  }

  let targets: ModelNode[]
  if (options?.modelId) {
    const model = catalog.models.find((row) => row.id === options.modelId)
    if (!model) throw new HubRefreshError("MODEL_NOT_FOUND")
    if (!isOpenWeight(model)) throw new HubRefreshError("NOT_OPEN")
    targets = [model]
  } else {
    targets = catalog.models.filter(isOpenWeight)
  }

  const existing = await readHubSnapshot()
  const details = await mapPool(targets, HUB_CONCURRENCY, (model) =>
    fetchHubDetail(model, existing?.models[model.id]),
  )
  const models = { ...(existing?.models ?? {}) }
  for (let i = 0; i < targets.length; i++) {
    models[targets[i].id] = details[i]
  }

  const snapshot = await writeHubSnapshot({
    fetchedAt: new Date().toISOString(),
    models,
  })

  return { snapshot, stats: statsFor(details) }
}
