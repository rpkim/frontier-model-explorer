import { get, put } from "@vercel/blob"
import type {
  HubDetail,
  HubModelSizeSource,
  HubSnapshot,
  HubServingLinks,
  HubTensorDtype,
  HubVramEstimate,
} from "./types"

export const HUB_SNAPSHOT_PATHNAME = "frontier-models/hub/latest.json"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseServing(value: unknown): HubServingLinks | undefined {
  if (!isRecord(value)) return undefined
  const serving: HubServingLinks = {}
  if (typeof value.vllm === "string") serving.vllm = value.vllm
  if (typeof value.sglang === "string") serving.sglang = value.sglang
  if (typeof value.ollama === "string") serving.ollama = value.ollama
  return Object.keys(serving).length > 0 ? serving : undefined
}

function parseOptionalGb(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}

function parseVram(value: unknown): HubVramEstimate | undefined {
  if (!isRecord(value)) return undefined
  const fp16 = parseOptionalGb(value.fp16)
  const int8 = parseOptionalGb(value.int8)
  const int4 = parseOptionalGb(value.int4)
  const weights = parseOptionalGb(value.weights)
  const native = parseOptionalGb(value.native)
  const kvCache4k = parseOptionalGb(value.kvCache4k)
  const nativeDtype = typeof value.nativeDtype === "string" && value.nativeDtype ? value.nativeDtype : undefined
  const hasQuant = fp16 != null && int8 != null && int4 != null
  if (!hasQuant && native == null) return undefined
  const estimate: HubVramEstimate = {}
  if (fp16 != null) estimate.fp16 = fp16
  if (int8 != null) estimate.int8 = int8
  if (int4 != null) estimate.int4 = int4
  if (weights != null) estimate.weights = weights
  if (native != null) estimate.native = native
  if (nativeDtype) estimate.nativeDtype = nativeDtype
  if (kvCache4k != null) estimate.kvCache4k = kvCache4k
  return estimate
}

const SIZE_SOURCES = new Set<HubModelSizeSource>(["safetensors", "gguf", "usedStorage"])

function parseTensorDtypes(value: unknown): HubTensorDtype[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rows: HubTensorDtype[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.dtype !== "string" || !item.dtype) continue
    if (typeof item.parameterCount !== "number" || !Number.isFinite(item.parameterCount) || item.parameterCount <= 0) {
      continue
    }
    rows.push({ dtype: item.dtype, parameterCount: item.parameterCount })
  }
  return rows.length > 0 ? rows : undefined
}

function parseHubDetail(value: unknown): HubDetail | null {
  if (!isRecord(value) || typeof value.fetchedAt !== "string") return null
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined
  const detail: HubDetail = { fetchedAt: value.fetchedAt }
  if (typeof value.hfId === "string") detail.hfId = value.hfId
  if (typeof value.modelUrl === "string") detail.modelUrl = value.modelUrl
  if (typeof value.license === "string") detail.license = value.license
  if (typeof value.gated === "boolean") detail.gated = value.gated
  if (typeof value.parameterCount === "number" && Number.isFinite(value.parameterCount)) {
    detail.parameterCount = value.parameterCount
  }
  if (typeof value.modelSizeBytes === "number" && Number.isFinite(value.modelSizeBytes) && value.modelSizeBytes > 0) {
    detail.modelSizeBytes = value.modelSizeBytes
  }
  if (typeof value.safetensorsBytes === "number" && Number.isFinite(value.safetensorsBytes)) {
    detail.safetensorsBytes = value.safetensorsBytes
  }
  if (typeof value.modelSizeSource === "string" && SIZE_SOURCES.has(value.modelSizeSource as HubModelSizeSource)) {
    detail.modelSizeSource = value.modelSizeSource as HubModelSizeSource
  }
  const tensorDtypes = parseTensorDtypes(value.tensorDtypes)
  if (tensorDtypes) detail.tensorDtypes = tensorDtypes
  if (typeof value.primaryDtype === "string" && value.primaryDtype) detail.primaryDtype = value.primaryDtype
  if (typeof value.torchDtype === "string" && value.torchDtype) detail.torchDtype = value.torchDtype
  if (typeof value.pipelineTag === "string") detail.pipelineTag = value.pipelineTag
  if (tags && tags.length > 0) detail.tags = tags
  if (typeof value.officialUrl === "string") detail.officialUrl = value.officialUrl
  const serving = parseServing(value.serving)
  if (serving) detail.serving = serving
  const vram = parseVram(value.vramEstimate)
  if (vram) detail.vramEstimate = vram
  if (typeof value.error === "string") detail.error = value.error
  return detail
}

export function isHubSnapshot(value: unknown): value is HubSnapshot {
  if (!isRecord(value) || typeof value.fetchedAt !== "string" || !isRecord(value.models)) return false
  return Object.values(value.models).every((row) => parseHubDetail(row) !== null)
}

export async function readHubSnapshot(): Promise<HubSnapshot | null> {
  try {
    const result = await get(HUB_SNAPSHOT_PATHNAME, { access: "private" })
    if (!result) return null

    const text = await new Response(result.stream).text()
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== "string" || !isRecord(parsed.models)) return null

    const models: Record<string, HubDetail> = {}
    for (const [id, row] of Object.entries(parsed.models)) {
      const detail = parseHubDetail(row)
      if (detail) models[id] = detail
    }
    return { fetchedAt: parsed.fetchedAt, models }
  } catch (error) {
    console.error("[v0] Failed to read hub snapshot from Blob:", error)
    return null
  }
}

export async function writeHubSnapshot(snapshot: HubSnapshot): Promise<HubSnapshot> {
  await put(HUB_SNAPSHOT_PATHNAME, JSON.stringify(snapshot), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return snapshot
}
