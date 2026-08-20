import { BENCHMARK_KEYS, type ModelNode, type RawModel } from "./types"

/** Treats missing, null, or non-finite numbers as "no data" rather than 0. */
function num(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  return value
}

/**
 * A handful of very early/placeholder catalog entries report 0 for every
 * pricing & speed field with no evaluation data at all. Treat those as
 * "not yet benchmarked" so they don't pollute price/speed rankings as free/instant.
 */
function zeroAsUnknown(value: number | null): number | null {
  if (value === null || value === 0) return null
  return value
}

export function normalizeModel(raw: RawModel): ModelNode {
  const evaluations = raw.evaluations ?? {}
  const pricing = raw.pricing ?? {}

  const benchmarks: ModelNode["benchmarks"] = {}
  for (const key of BENCHMARK_KEYS) {
    const value = num(evaluations[key])
    if (value !== null) benchmarks[key] = value
  }

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    releaseDate: raw.release_date ?? null,
    provider: {
      id: raw.model_creator.id,
      name: raw.model_creator.name,
      slug: raw.model_creator.slug ?? raw.model_creator.id,
    },
    intelligenceIndex: num(evaluations.artificial_analysis_intelligence_index),
    codingIndex: num(evaluations.artificial_analysis_coding_index),
    mathIndex: num(evaluations.artificial_analysis_math_index),
    benchmarks,
    priceInputPerM: zeroAsUnknown(num(pricing.price_1m_input_tokens)),
    priceOutputPerM: zeroAsUnknown(num(pricing.price_1m_output_tokens)),
    priceBlendedPerM: zeroAsUnknown(num(pricing.price_1m_blended_3_to_1)),
    outputTokensPerSecond: zeroAsUnknown(num(raw.median_output_tokens_per_second)),
    timeToFirstTokenSeconds: zeroAsUnknown(num(raw.median_time_to_first_token_seconds)),
    timeToFirstAnswerTokenSeconds: zeroAsUnknown(num(raw.median_time_to_first_answer_token)),
  }
}

export function normalizeModels(raw: RawModel[]): ModelNode[] {
  return raw.map(normalizeModel)
}
