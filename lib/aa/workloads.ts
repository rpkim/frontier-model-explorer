import type { BenchmarkKey } from "./types"

/**
 * Task profiles used for value-for-money analysis.
 *
 * A single blended 3:1 price is a chat convention and misprices every other
 * workload: retrieval runs input-heavy (10:1–30:1), tool-using agents around
 * 10:1, and reasoning models output-heavy (1:5) because thinking tokens are
 * billed as output. Since the median output price in this catalog is ~4x the
 * median input price, two models that tie on blended price can differ several
 * fold on a real workload. Each profile therefore carries its own token mix,
 * quality signals, and latency class.
 */

export type QualitySignal = "intelligence" | "coding" | "math" | BenchmarkKey

export const WORKLOAD_IDS = ["chat", "rag", "toolAgent", "codingAgent", "reasoning", "bulkExtraction"] as const

export type WorkloadId = (typeof WORKLOAD_IDS)[number]

export type LatencyClass = "interactive" | "responsive" | "batch"

export interface LatencyLimit {
  maxTtftSeconds: number | null
  minTokensPerSecond: number | null
}

/** Latency floors by class. Percentiles are from the current catalog (TTFT median ~1.4s, throughput median ~89 tok/s). */
export const LATENCY_LIMITS: Record<LatencyClass, LatencyLimit> = {
  interactive: { maxTtftSeconds: 2, minTokensPerSecond: 40 },
  responsive: { maxTtftSeconds: 10, minTokensPerSecond: 20 },
  batch: { maxTtftSeconds: null, minTokensPerSecond: null },
}

export interface WorkloadProfile {
  id: WorkloadId
  inputTokensPerTask: number
  outputTokensPerTask: number
  /** Task volume used to turn $/token into a monthly bill readers can act on. */
  monthlyTasks: number
  /** Weighted quality signals; each is max-normalized across the snapshot before averaging. */
  quality: ReadonlyArray<{ signal: QualitySignal; weight: number }>
  /** Accuracy benchmarks used as a success-rate proxy, in priority order. */
  successSignals: readonly BenchmarkKey[]
  /**
   * Quality percentile a model must reach to be recommendable, as a fraction of
   * the rated pool. A percentile rather than an absolute score so the bar keeps
   * its meaning as the catalog grows and scores inflate.
   */
  qualityFloorPercentile: number
  latency: LatencyClass
}

export const WORKLOAD_PROFILES: Record<WorkloadId, WorkloadProfile> = {
  chat: {
    id: "chat",
    inputTokensPerTask: 1_500,
    outputTokensPerTask: 500,
    monthlyTasks: 100_000,
    quality: [
      { signal: "intelligence", weight: 0.5 },
      { signal: "ifbench", weight: 0.3 },
      { signal: "mmlu_pro", weight: 0.2 },
    ],
    successSignals: ["ifbench", "mmlu_pro", "gpqa"],
    qualityFloorPercentile: 0.5,
    latency: "interactive",
  },
  rag: {
    id: "rag",
    inputTokensPerTask: 20_000,
    outputTokensPerTask: 1_000,
    monthlyTasks: 50_000,
    quality: [
      { signal: "lcr", weight: 0.45 },
      { signal: "mmlu_pro", weight: 0.3 },
      { signal: "intelligence", weight: 0.25 },
    ],
    successSignals: ["lcr", "mmlu_pro"],
    qualityFloorPercentile: 0.55,
    latency: "responsive",
  },
  toolAgent: {
    id: "toolAgent",
    inputTokensPerTask: 15_000,
    outputTokensPerTask: 1_500,
    monthlyTasks: 30_000,
    quality: [
      { signal: "tau2", weight: 0.45 },
      { signal: "tau_banking", weight: 0.2 },
      { signal: "ifbench", weight: 0.2 },
      { signal: "intelligence", weight: 0.15 },
    ],
    successSignals: ["tau2", "tau_banking"],
    qualityFloorPercentile: 0.65,
    latency: "responsive",
  },
  codingAgent: {
    id: "codingAgent",
    inputTokensPerTask: 40_000,
    outputTokensPerTask: 12_000,
    monthlyTasks: 3_000,
    quality: [
      { signal: "coding", weight: 0.35 },
      { signal: "terminalbench_v2_1", weight: 0.3 },
      { signal: "livecodebench", weight: 0.2 },
      { signal: "terminalbench_hard", weight: 0.15 },
    ],
    successSignals: ["terminalbench_v2_1", "terminalbench_hard", "livecodebench"],
    qualityFloorPercentile: 0.7,
    latency: "batch",
  },
  reasoning: {
    id: "reasoning",
    inputTokensPerTask: 2_000,
    outputTokensPerTask: 10_000,
    monthlyTasks: 5_000,
    quality: [
      { signal: "gpqa", weight: 0.35 },
      { signal: "hle", weight: 0.3 },
      { signal: "math", weight: 0.2 },
      { signal: "aime_25", weight: 0.15 },
    ],
    successSignals: ["gpqa", "hle"],
    qualityFloorPercentile: 0.75,
    latency: "batch",
  },
  bulkExtraction: {
    id: "bulkExtraction",
    inputTokensPerTask: 800,
    outputTokensPerTask: 40,
    monthlyTasks: 2_000_000,
    quality: [
      { signal: "ifbench", weight: 0.4 },
      { signal: "mmlu_pro", weight: 0.35 },
      { signal: "intelligence", weight: 0.25 },
    ],
    successSignals: ["ifbench", "mmlu_pro"],
    qualityFloorPercentile: 0.35,
    latency: "batch",
  },
}

export const WORKLOAD_PROFILE_LIST: readonly WorkloadProfile[] = WORKLOAD_IDS.map((id) => WORKLOAD_PROFILES[id])

/** Input:output ratio as a display string, e.g. "20:1". */
export function tokenRatioLabel(profile: WorkloadProfile): string {
  const { inputTokensPerTask: input, outputTokensPerTask: output } = profile
  if (output === 0) return `${input}:0`
  return input >= output
    ? `${Math.round((input / output) * 10) / 10}:1`
    : `1:${Math.round((output / input) * 10) / 10}`
}
