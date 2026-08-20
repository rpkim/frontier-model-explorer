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
import type {
  HubDetail,
  HubModelSizeSource,
  HubSnapshot,
  HubTensorDtype,
  HubVramEstimate,
  ModelNode,
} from "./types"

export const VLLM_DOCS_URL = "https://docs.vllm.ai/en/stable/cli/serve.html"
export const SGLANG_DOCS_URL = "https://docs.sglang.ai/"

const HF_API_TIMEOUT_MS = 12_000
const HF_CONFIG_TIMEOUT_MS = 6_000
const HF_SEARCH_TIMEOUT_MS = 8_000
const HUB_CONCURRENCY = 4
const HUB_FRESH_MS = 12 * 60 * 60 * 1000
const VRAM_OVERHEAD = 1.2
const HF_SEARCH_LIMIT = 8

/** Repeated `expand=` values. HF rejects comma-separated expand (HTTP 400). */
const HF_MODEL_EXPAND = [
  "safetensors",
  "cardData",
  "siblings",
  "usedStorage",
  "gated",
  "tags",
  "pipeline_tag",
] as const

export type HubRefreshErrorCode =
  | "NO_SNAPSHOT"
  | "MODEL_NOT_FOUND"
  | "NOT_OPEN"
  | "HUB_STORE_FAILED"
  | "UNKNOWN_HUB_ERROR"

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

interface HfConfigExtras {
  parameterCount?: number
  torchDtype?: string
  hiddenSize?: number
  numLayers?: number
  numAttentionHeads?: number
  numKvHeads?: number
  headDim?: number
}

interface ModelSizeInfo {
  bytes: number
  source: HubModelSizeSource
  ggufFilename?: string
}

const DTYPE_BYTES: Record<string, number> = {
  F64: 8,
  F32: 4,
  F16: 2,
  BF16: 2,
  F8: 1,
  F8E4M3: 1,
  F8_E4M3: 1,
  F8E5M2: 1,
  F8_E5M2: 1,
  I64: 8,
  I32: 4,
  I16: 2,
  I8: 1,
  U8: 1,
  I4: 0.5,
  U4: 0.5,
  BOOL: 1,
}

const DTYPE_ALIASES: Record<string, string> = {
  BFLOAT16: "BF16",
  FLOAT16: "F16",
  FLOAT32: "F32",
  FLOAT64: "F64",
  FLOAT8: "F8",
  FP16: "F16",
  FP32: "F32",
  FP64: "F64",
  HALF: "F16",
  FLOAT: "F32",
  DOUBLE: "F64",
  INT8: "I8",
  UINT8: "U8",
  INT4: "I4",
  UINT4: "U4",
  INT16: "I16",
  INT32: "I32",
  INT64: "I64",
}

const KV_CONTEXT_TOKENS = 4096
const KV_BYTES_PER_ELEM = 2

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hfModelInfoUrl(hfId: string): string {
  const params = new URLSearchParams()
  for (const field of HF_MODEL_EXPAND) params.append("expand", field)
  params.set("blobs", "true")
  return `https://huggingface.co/api/models/${hfId}?${params.toString()}`
}

function parameterCountFromInfo(info: HfModelInfo): number | undefined {
  const total = asFiniteNumber(info.safetensors?.total)
  if (total) return total
  const params = info.safetensors?.parameters
  if (!isPlainRecord(params)) return undefined
  let sum = 0
  for (const value of Object.values(params)) {
    if (typeof value === "number" && Number.isFinite(value)) sum += value
  }
  return sum > 0 ? sum : undefined
}

export function normalizeDtype(raw: string): string {
  const upper = raw.trim().toUpperCase().replace(/^TORCH\./, "")
  const compact = upper.replace(/[-_.]/g, "")
  return DTYPE_ALIASES[compact] ?? upper.replace(/-/g, "_")
}

function bytesPerDtype(dtype: string): number | undefined {
  const normalized = normalizeDtype(dtype)
  return DTYPE_BYTES[normalized] ?? DTYPE_BYTES[normalized.replace(/_/g, "")]
}

function siblingFiles(
  info: HfModelInfo,
  predicate: (name: string) => boolean,
): { name: string; size: number }[] {
  const files: { name: string; size: number }[] = []
  if (!Array.isArray(info.siblings)) return files
  for (const sibling of info.siblings) {
    if (!sibling || typeof sibling.rfilename !== "string") continue
    if (!predicate(sibling.rfilename)) continue
    const size = asFiniteNumber(sibling.size)
    if (!size) continue
    files.push({ name: sibling.rfilename, size })
  }
  return files
}

function modelSizeFromInfo(info: HfModelInfo): ModelSizeInfo | undefined {
  const safetensors = siblingFiles(info, (name) => name.endsWith(".safetensors"))
  const safetensorsBytes = safetensors.reduce((sum, file) => sum + file.size, 0)
  if (safetensorsBytes > 0) return { bytes: safetensorsBytes, source: "safetensors" }

  const gguf = siblingFiles(info, (name) => name.toLowerCase().endsWith(".gguf"))
  if (gguf.length > 0) {
    const primary = gguf.reduce((best, file) => (file.size > best.size ? file : best))
    return { bytes: primary.size, source: "gguf", ggufFilename: primary.name }
  }

  const used = asFiniteNumber(info.usedStorage)
  if (used) return { bytes: used, source: "usedStorage" }
  return undefined
}

function tensorDtypesFromInfo(info: HfModelInfo): HubTensorDtype[] | undefined {
  const params = info.safetensors?.parameters
  if (!isPlainRecord(params)) return undefined
  const rows: HubTensorDtype[] = []
  for (const [dtype, count] of Object.entries(params)) {
    if (typeof dtype !== "string" || !dtype) continue
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue
    rows.push({ dtype: normalizeDtype(dtype), parameterCount: count })
  }
  rows.sort((a, b) => b.parameterCount - a.parameterCount)
  return rows.length > 0 ? rows : undefined
}

function dtypeFromGgufFilename(filename: string): string | undefined {
  const match = filename.match(
    /(?:^|[.\-_])(IQ[1-4](?:_[A-Z0-9]+)*|Q[2-8](?:_[A-Z0-9]+)*|BF16|F16|F32|FP16)(?:[.\-_]|\.gguf$)/i,
  )
  return match ? normalizeDtype(match[1]) : undefined
}

function weightBytesFromDtypes(dtypes: HubTensorDtype[]): number | undefined {
  let sum = 0
  for (const row of dtypes) {
    const width = bytesPerDtype(row.dtype)
    if (width == null) return undefined
    sum += row.parameterCount * width
  }
  return sum > 0 ? sum : undefined
}

function nativeWeightBytes(size: ModelSizeInfo | undefined, dtypes: HubTensorDtype[] | undefined): number | undefined {
  if (size && (size.source === "safetensors" || size.source === "gguf")) return size.bytes
  const fromDtypes = dtypes ? weightBytesFromDtypes(dtypes) : undefined
  if (fromDtypes) return fromDtypes
  return size?.bytes
}

function pickConfigNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = asFiniteNumber(row[key])
    if (value != null) return value
  }
  return undefined
}

function kvCacheBytes(cfg: HfConfigExtras, seqLen = KV_CONTEXT_TOKENS): number | undefined {
  const layers = cfg.numLayers
  const kvHeads = cfg.numKvHeads ?? cfg.numAttentionHeads
  const headDim =
    cfg.headDim ??
    (cfg.hiddenSize && cfg.numAttentionHeads ? cfg.hiddenSize / cfg.numAttentionHeads : undefined)
  if (!layers || !kvHeads || !headDim || !Number.isFinite(headDim) || headDim <= 0) return undefined
  const bytes = 2 * layers * kvHeads * headDim * seqLen * KV_BYTES_PER_ELEM
  return bytes > 0 ? bytes : undefined
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

export function estimateVramGb(
  parameterCount: number | undefined,
  extras?: {
    nativeWeightBytes?: number
    nativeDtype?: string
    kvCache4kBytes?: number
  },
): HubVramEstimate | undefined {
  const estimate: HubVramEstimate = {}
  if (parameterCount != null) {
    const weightGb = (bytesPerParam: number) => (parameterCount * bytesPerParam * VRAM_OVERHEAD) / 1e9
    estimate.fp16 = roundGb(weightGb(2))
    estimate.int8 = roundGb(weightGb(1))
    estimate.int4 = roundGb(weightGb(0.5))
  }

  let nativeBytes = extras?.nativeWeightBytes
  if (nativeBytes == null && extras?.nativeDtype && parameterCount != null) {
    const width = bytesPerDtype(extras.nativeDtype)
    if (width != null) nativeBytes = parameterCount * width
  }
  if (nativeBytes != null) {
    estimate.weights = roundGb(nativeBytes / 1e9)
    estimate.native = roundGb((nativeBytes * VRAM_OVERHEAD) / 1e9)
    if (extras?.nativeDtype) estimate.nativeDtype = extras.nativeDtype
  }

  if (extras?.kvCache4kBytes != null) {
    estimate.kvCache4k = roundGb(extras.kvCache4kBytes / 1e9)
  }

  if (estimate.fp16 == null && estimate.native == null) return undefined
  return estimate
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

async function fetchJson(
  url: string,
  timeoutMs: number,
): Promise<{ ok: true; json: unknown } | { ok: false; status: number; timedOut: boolean }> {
  try {
    const res = await fetch(url, {
      headers: hfHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { ok: false, status: res.status, timedOut: false }
    const text = await res.text()
    if (!text.trim()) return { ok: false, status: res.status, timedOut: false }
    try {
      return { ok: true, json: JSON.parse(text) }
    } catch {
      return { ok: false, status: res.status, timedOut: false }
    }
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError"
    return { ok: false, status: 0, timedOut: timedOut || errorFromCatch(error) === "timeout" }
  }
}

function configExtrasFromRow(row: Record<string, unknown>): HfConfigExtras {
  const extras: HfConfigExtras = {}
  extras.parameterCount = asFiniteNumber(row.num_parameters) ?? asFiniteNumber(row.n_params)
  const torch = row.torch_dtype ?? row.dtype
  if (typeof torch === "string" && torch.trim()) extras.torchDtype = normalizeDtype(torch)
  extras.hiddenSize = pickConfigNumber(row, ["hidden_size", "n_embd", "d_model"])
  extras.numLayers = pickConfigNumber(row, ["num_hidden_layers", "n_layer", "n_layers", "num_layers"])
  extras.numAttentionHeads = pickConfigNumber(row, ["num_attention_heads", "n_head", "n_heads", "num_heads"])
  extras.numKvHeads = pickConfigNumber(row, ["num_key_value_heads", "num_kv_heads", "n_kv_head", "n_kv_heads"])
  extras.headDim = pickConfigNumber(row, ["head_dim", "head_size"])
  return extras
}

async function fetchConfigExtras(hfId: string): Promise<HfConfigExtras | undefined> {
  const url = `https://huggingface.co/${hfId}/raw/main/config.json`
  try {
    const res = await fetch(url, {
      headers: hfHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(HF_CONFIG_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const text = await res.text()
    if (!text.trim() || text.trimStart().startsWith("<")) return undefined
    const json: unknown = JSON.parse(text)
    if (!isPlainRecord(json)) return undefined
    return configExtrasFromRow(json)
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
  try {
    const result = await fetchJson(hfModelInfoUrl(mapping.hfId), HF_API_TIMEOUT_MS)

    if (!result.ok) {
      const error = errorFromStatus(result.status, result.timedOut)
      console.error("[v0] Hugging Face model info failed:", mapping.hfId, error, result.status || "")
      return {
        ...detail,
        gated: error === "gated" ? true : detail.gated,
        error,
      }
    }

    if (!isPlainRecord(result.json)) {
      return { ...detail, error: "fetch_failed" }
    }

    const info = result.json as HfModelInfo
    const gated = isGatedFlag(info.gated)
    const size = modelSizeFromInfo(info)
    const tensorDtypes = tensorDtypesFromInfo(info)
    let parameterCount = parameterCountFromInfo(info)
    let torchDtype: string | undefined
    let kvBytes: number | undefined

    if (parameterCount == null || tensorDtypes == null) {
      const config = await fetchConfigExtras(mapping.hfId)
      if (config) {
        if (parameterCount == null) parameterCount = config.parameterCount
        torchDtype = config.torchDtype
        kvBytes = kvCacheBytes(config)
      }
    }

    const primaryDtype =
      tensorDtypes?.[0]?.dtype ??
      torchDtype ??
      (size?.ggufFilename ? dtypeFromGgufFilename(size.ggufFilename) : undefined)
    const nativeBytes = nativeWeightBytes(size, tensorDtypes)

    const resolvedId = typeof info.id === "string" && info.id ? info.id : mapping.hfId
    const next: HubDetail = {
      ...detail,
      hfId: resolvedId,
      modelUrl: `https://huggingface.co/${resolvedId}`,
      gated,
      pipelineTag: typeof info.pipeline_tag === "string" ? info.pipeline_tag : undefined,
      tags: Array.isArray(info.tags)
        ? info.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 24)
        : undefined,
    }

    const license = licenseFromInfo(info)
    if (license) next.license = license
    if (parameterCount != null) next.parameterCount = parameterCount
    if (size) {
      next.modelSizeBytes = size.bytes
      next.modelSizeSource = size.source
      if (size.source === "safetensors") next.safetensorsBytes = size.bytes
    }
    if (tensorDtypes) next.tensorDtypes = tensorDtypes
    if (primaryDtype) next.primaryDtype = primaryDtype
    if (torchDtype) next.torchDtype = torchDtype

    const vram = estimateVramGb(parameterCount, {
      nativeWeightBytes: nativeBytes,
      nativeDtype: primaryDtype,
      kvCache4kBytes: kvBytes,
    })
    if (vram) next.vramEstimate = vram

    if (gated && !hfToken() && parameterCount == null && !license && !size) {
      next.error = "gated"
    }

    return next
  } catch (error) {
    console.error("[v0] Hugging Face model info threw:", mapping.hfId, error)
    return { ...detail, error: errorFromCatch(error) }
  }
}

function reusableHubDetail(detail: HubDetail | undefined, force: boolean): HubDetail | undefined {
  if (force || !detail) return undefined
  const fetched = Date.parse(detail.fetchedAt)
  if (!Number.isFinite(fetched) || Date.now() - fetched > HUB_FRESH_MS) return undefined
  if (detail.error === "timeout" || detail.error === "rate_limited" || detail.error === "fetch_failed") {
    return undefined
  }
  if (detail.error) return detail
  if (detail.modelSizeBytes != null || detail.primaryDtype != null || detail.parameterCount != null) return detail
  return undefined
}

async function fetchHubDetail(model: ModelNode, existing?: HubDetail): Promise<HubDetail> {
  const fetchedAt = new Date().toISOString()
  try {
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
  } catch (error) {
    console.error("[v0] Hub detail refresh threw for model:", model.id, error)
    return {
      ...(existing?.hfId
        ? {
            hfId: existing.hfId,
            modelUrl: existing.modelUrl,
            serving: existing.serving,
            officialUrl: existing.officialUrl,
          }
        : {}),
      fetchedAt,
      error: errorFromCatch(error),
    }
  }
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
  const force = Boolean(options?.modelId)
  let fetchedCount = 0
  const details = await mapPool(targets, HUB_CONCURRENCY, async (model) => {
    const previous = existing?.models[model.id]
    const reusable = reusableHubDetail(previous, force)
    if (reusable) return reusable
    fetchedCount += 1
    return fetchHubDetail(model, previous)
  })
  const models = { ...(existing?.models ?? {}) }
  for (let i = 0; i < targets.length; i++) {
    models[targets[i].id] = details[i]
  }

  if (fetchedCount === 0 && existing) {
    return { snapshot: existing, stats: statsFor(details) }
  }

  try {
    const snapshot = await writeHubSnapshot({
      fetchedAt: new Date().toISOString(),
      models,
    })
    return { snapshot, stats: statsFor(details) }
  } catch (error) {
    console.error("[v0] Failed to write hub snapshot to Blob:", error)
    throw new HubRefreshError("HUB_STORE_FAILED")
  }
}
