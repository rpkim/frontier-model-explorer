import { isOpenWeight } from "./filter"
import type { ModelNode } from "./types"

const MAX_JSON_CHARS = 280_000

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function compactModel(
  model: ModelNode,
  includeBenchmarks: boolean,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    n: model.name,
    p: model.provider.name,
  }
  if (model.releaseDate) row.d = model.releaseDate
  if (model.intelligenceIndex != null) row.i = round(model.intelligenceIndex, 1)
  if (model.codingIndex != null) row.c = round(model.codingIndex, 1)
  if (model.mathIndex != null) row.m = round(model.mathIndex, 1)
  if (model.priceInputPerM != null) row.pin = round(model.priceInputPerM, 4)
  if (model.priceOutputPerM != null) row.pout = round(model.priceOutputPerM, 4)
  if (model.priceBlendedPerM != null) row.pbl = round(model.priceBlendedPerM, 4)
  if (model.outputTokensPerSecond != null) row.tps = round(model.outputTokensPerSecond, 1)
  if (model.timeToFirstTokenSeconds != null) row.ttft = round(model.timeToFirstTokenSeconds, 3)
  row.ow = isOpenWeight(model) ? 1 : 0

  if (includeBenchmarks) {
    const benches: Record<string, number> = {}
    for (const [key, value] of Object.entries(model.benchmarks)) {
      if (typeof value === "number") benches[key] = round(value, 3)
    }
    if (Object.keys(benches).length > 0) row.b = benches
  }

  return row
}

export interface SerializedCatalog {
  json: string
  /** The rows the JSON encodes, for callers that need the numbers rather than the text. */
  rows: Record<string, unknown>[]
  modelCount: number
  truncatedFields: boolean
}

export function serializeCatalogForAgent(models: ModelNode[]): SerializedCatalog {
  const withBenchmarks = models.map((model) => compactModel(model, true))
  const json = JSON.stringify(withBenchmarks)
  if (json.length <= MAX_JSON_CHARS) {
    return { json, rows: withBenchmarks, modelCount: models.length, truncatedFields: false }
  }

  const withoutBenchmarks = models.map((model) => compactModel(model, false))
  return {
    json: JSON.stringify(withoutBenchmarks),
    rows: withoutBenchmarks,
    modelCount: models.length,
    truncatedFields: true,
  }
}

export const CATALOG_FIELD_LEGEND = [
  "n = model name",
  "p = provider / creator",
  "d = release date (YYYY-MM-DD)",
  "i = Intelligence Index",
  "c = Coding Index",
  "m = Math Index",
  "pin = input price USD per 1M tokens",
  "pout = output price USD per 1M tokens",
  "pbl = blended price USD per 1M tokens (3:1)",
  "tps = median output tokens per second",
  "ttft = median time to first token in seconds",
  "ow = 1 if open-weight heuristic, else 0",
  "b = named benchmark scores (Artificial Analysis keys)",
].join("; ")
