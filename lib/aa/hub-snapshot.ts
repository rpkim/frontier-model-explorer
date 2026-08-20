import { get, put } from "@vercel/blob"
import type { HubDetail, HubSnapshot, HubServingLinks, HubVramEstimate } from "./types"

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

function parseVram(value: unknown): HubVramEstimate | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.fp16 !== "number" || typeof value.int8 !== "number" || typeof value.int4 !== "number") {
    return undefined
  }
  if (![value.fp16, value.int8, value.int4].every(Number.isFinite)) return undefined
  return { fp16: value.fp16, int8: value.int8, int4: value.int4 }
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
  if (typeof value.safetensorsBytes === "number" && Number.isFinite(value.safetensorsBytes)) {
    detail.safetensorsBytes = value.safetensorsBytes
  }
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
