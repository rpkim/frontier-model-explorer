import { z } from "zod"

// Raw response shape from the Artificial Analysis Data API
// GET https://artificialanalysis.ai/api/v2/data/llms/models
const rawEvaluationsSchema = z.object({
  artificial_analysis_intelligence_index: z.number().nullable().optional(),
  artificial_analysis_coding_index: z.number().nullable().optional(),
  artificial_analysis_math_index: z.number().nullable().optional(),
  mmlu_pro: z.number().nullable().optional(),
  gpqa: z.number().nullable().optional(),
  hle: z.number().nullable().optional(),
  livecodebench: z.number().nullable().optional(),
  scicode: z.number().nullable().optional(),
  math_500: z.number().nullable().optional(),
  aime: z.number().nullable().optional(),
  aime_25: z.number().nullable().optional(),
  ifbench: z.number().nullable().optional(),
  lcr: z.number().nullable().optional(),
  terminalbench_hard: z.number().nullable().optional(),
  terminalbench_v2_1: z.number().nullable().optional(),
  tau2: z.number().nullable().optional(),
  tau_banking: z.number().nullable().optional(),
})

const rawPricingSchema = z.object({
  price_1m_blended_3_to_1: z.number().nullable().optional(),
  price_1m_input_tokens: z.number().nullable().optional(),
  price_1m_output_tokens: z.number().nullable().optional(),
})

const rawModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  release_date: z.string().nullable().optional(),
  model_creator: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
  }),
  evaluations: rawEvaluationsSchema.optional(),
  pricing: rawPricingSchema.optional(),
  median_output_tokens_per_second: z.number().nullable().optional(),
  median_time_to_first_token_seconds: z.number().nullable().optional(),
  median_time_to_first_answer_token: z.number().nullable().optional(),
})

export const rawApiResponseSchema = z.object({
  status: z.number(),
  data: z.array(rawModelSchema),
})

export type RawApiResponse = z.infer<typeof rawApiResponseSchema>
export type RawModel = z.infer<typeof rawModelSchema>

// Named sub-benchmarks we surface individually in the UI
export const BENCHMARK_KEYS = [
  "mmlu_pro",
  "gpqa",
  "hle",
  "livecodebench",
  "scicode",
  "math_500",
  "aime",
  "aime_25",
  "ifbench",
  "lcr",
  "terminalbench_hard",
  "terminalbench_v2_1",
  "tau2",
  "tau_banking",
] as const

export type BenchmarkKey = (typeof BENCHMARK_KEYS)[number]

export const BENCHMARK_LABELS: Record<BenchmarkKey, string> = {
  mmlu_pro: "MMLU-Pro",
  gpqa: "GPQA Diamond",
  hle: "Humanity's Last Exam",
  livecodebench: "LiveCodeBench",
  scicode: "SciCode",
  math_500: "MATH-500",
  aime: "AIME",
  aime_25: "AIME 2025",
  ifbench: "IFBench",
  lcr: "LCR",
  terminalbench_hard: "Terminal-Bench (Hard)",
  terminalbench_v2_1: "Terminal-Bench v2.1",
  tau2: "Tau²",
  tau_banking: "Tau² Banking",
}

// Normalized, internal representation used throughout the app.
// Keeping this separate from the raw API shape insulates the UI from upstream changes.
export interface Provider {
  id: string
  name: string
  slug: string
}

export interface ModelNode {
  id: string
  name: string
  slug: string
  releaseDate: string | null
  provider: Provider
  intelligenceIndex: number | null
  codingIndex: number | null
  mathIndex: number | null
  benchmarks: Partial<Record<BenchmarkKey, number>>
  priceInputPerM: number | null
  priceOutputPerM: number | null
  priceBlendedPerM: number | null
  outputTokensPerSecond: number | null
  timeToFirstTokenSeconds: number | null
  timeToFirstAnswerTokenSeconds: number | null
}

export interface Snapshot {
  syncedAt: string
  models: ModelNode[]
}

/** Hugging Face / local-serving enrichment, stored separately from the AA index. */
export interface HubServingLinks {
  vllm?: string
  sglang?: string
  ollama?: string
}

export interface HubVramEstimate {
  /** Estimated GB (weights × dtype bytes + ~20% overhead). */
  fp16: number
  int8: number
  int4: number
}

export interface HubDetail {
  hfId?: string
  modelUrl?: string
  license?: string
  gated?: boolean
  parameterCount?: number
  safetensorsBytes?: number
  pipelineTag?: string
  tags?: string[]
  officialUrl?: string
  serving?: HubServingLinks
  vramEstimate?: HubVramEstimate
  /** Machine-readable status: unmapped (no HF id found) | gated | not_found | timeout | rate_limited | fetch_failed */
  error?: string
  fetchedAt: string
}

export interface HubSnapshot {
  fetchedAt: string
  models: Record<string, HubDetail>
}

export interface CatalogReport {
  generatedAt: string
  locale: string
  markdown: string
  modelCount: number
  model: string
  snapshotSyncedAt: string
}
