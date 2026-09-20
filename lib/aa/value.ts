import { isOpenWeight } from "./filter"
import {
  LATENCY_LIMITS,
  WORKLOAD_PROFILE_LIST,
  tokenRatioLabel,
  type QualitySignal,
  type WorkloadId,
  type WorkloadProfile,
} from "./workloads"
import type { ModelNode } from "./types"

/**
 * Deterministic value-for-money math.
 *
 * The report LLM narrates these numbers but never derives them: frontier and
 * cost arithmetic belong in code, where they are reproducible and testable.
 *
 * The headline metric is cost per *successful* task, not cost per token. Cost
 * per attempt divided by a success rate is the standard correction, because a
 * model that is 20% cheaper per attempt but materially less reliable is more
 * expensive per delivered result.
 */

/** Below this success rate the division blows up and the estimate stops being meaningful. */
const MIN_USABLE_SUCCESS_RATE = 0.05

/**
 * A model must have at least this fraction of a profile's quality weight present
 * to be rated. High enough that no model is scored on a single lucky benchmark.
 */
const MIN_QUALITY_COVERAGE = 0.6

export type LatencyStatus = "ok" | "unknown" | "slow"

export interface ModelValue {
  modelId: string
  name: string
  provider: string
  openWeight: boolean
  priceInputPerM: number
  priceOutputPerM: number
  /** Cost of one attempt at the profile's token mix, USD. */
  costPerTaskUsd: number
  /** costPerTaskUsd x monthlyTasks, USD. */
  monthlyCostUsd: number
  /** Weighted, max-normalized quality on a 0–100 scale. */
  quality: number
  /** Fraction of the profile's quality weight that had data. */
  coverage: number
  /** Success-rate proxy (0–1) from the named benchmark, or null when unmeasured. */
  successRate: number | null
  successSignal: string | null
  /** costPerTaskUsd / successRate, USD. Null when no success signal exists. */
  costPerSuccessUsd: number | null
  ttftSeconds: number | null
  tokensPerSecond: number | null
  latencyStatus: LatencyStatus
}

export interface WorkloadValueAnalysis {
  workloadId: WorkloadId
  inputTokensPerTask: number
  outputTokensPerTask: number
  tokenRatio: string
  monthlyTasks: number
  /** Models with split prices and enough quality coverage to rate. */
  ratedCount: number
  /** Rated models that clear the quality floor and the latency class. */
  eligibleCount: number
  /** Rated models dropped because the profile is interactive and their latency is unmeasured. */
  unmeasuredLatencyCount: number
  /** Resolved quality floor on the 0–100 scale. */
  qualityFloor: number
  qualityFloorPercentile: number
  /** Share of rated models that clear the floor, so the bar can be stated without inverting the percentile. */
  qualityFloorTopPercent: number
  latencyClass: WorkloadProfile["latency"]
  /** Knee of the eligible frontier: where paying more stops buying much quality. */
  bestValue: ModelValue | null
  /** Next step up the frontier from bestValue — what the next increment of spend buys. */
  runnerUp: ModelValue | null
  /** Cheapest eligible model per attempt. */
  budget: ModelValue | null
  /** Highest quality that still clears the profile's latency class. */
  premium: ModelValue | null
  /** premium.costPerSuccessUsd / bestValue.costPerSuccessUsd. */
  premiumCostMultiple: number | null
  /** premium.quality - bestValue.quality, in points. */
  premiumQualityGain: number | null
  /** Cost/quality Pareto frontier over eligible models, cheapest first. */
  frontier: ModelValue[]
  /** Cheaper per attempt than bestValue yet no cheaper per success — the reason "cheap" is not "good value". */
  falseBargains: ModelValue[]
  /** Models that cost more than bestValue while scoring lower: strictly dominated. */
  overpriced: ModelValue[]
}

export interface ValueAnalysis {
  /** Token mixes and floors are disclosed so readers can judge the assumptions. */
  workloads: WorkloadValueAnalysis[]
  pricedModelCount: number
  unpricedModelCount: number
  /** Substitution candidates for the priciest high-quality models. */
  substitutions: Substitution[]
  /**
   * High-intelligence models with no API price. These are not "free" — they are
   * the self-hosting candidates the Guides tab is for.
   */
  unpricedWatchlist: WatchlistModel[]
}

export interface Substitution {
  workloadId: WorkloadId
  expensiveId?: string
  expensive: string
  expensiveMonthlyCostUsd: number
  alternativeId?: string
  alternative: string
  alternativeMonthlyCostUsd: number
  savingsPercent: number
  qualityDelta: number
}

export interface WatchlistModel {
  modelId: string
  name: string
  provider: string
  openWeight: boolean
  intelligenceIndex: number | null
  codingIndex: number | null
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)))
  return sorted[index]
}

function signalValue(model: ModelNode, signal: QualitySignal): number | null {
  switch (signal) {
    case "intelligence":
      return model.intelligenceIndex
    case "coding":
      return model.codingIndex
    case "math":
      return model.mathIndex
    default:
      return model.benchmarks[signal] ?? null
  }
}

/**
 * Index scores and benchmark fractions live on different scales, so each signal
 * is normalized against the strongest observed value in the snapshot.
 */
function signalMaxima(models: ModelNode[]): Map<QualitySignal, number> {
  const maxima = new Map<QualitySignal, number>()
  const signals = new Set<QualitySignal>()
  for (const profile of WORKLOAD_PROFILE_LIST) {
    for (const entry of profile.quality) signals.add(entry.signal)
  }

  for (const signal of signals) {
    let max = 0
    for (const model of models) {
      const value = signalValue(model, signal)
      if (value != null && value > max) max = value
    }
    if (max > 0) maxima.set(signal, max)
  }
  return maxima
}

function qualityFor(
  model: ModelNode,
  profile: WorkloadProfile,
  maxima: Map<QualitySignal, number>,
): { quality: number; coverage: number } | null {
  let weighted = 0
  let presentWeight = 0
  let totalWeight = 0

  for (const { signal, weight } of profile.quality) {
    totalWeight += weight
    const value = signalValue(model, signal)
    const max = maxima.get(signal)
    if (value == null || !max) continue
    weighted += (value / max) * weight
    presentWeight += weight
  }

  if (totalWeight === 0 || presentWeight / totalWeight < MIN_QUALITY_COVERAGE) return null

  return {
    quality: round((weighted / presentWeight) * 100, 1),
    coverage: round(presentWeight / totalWeight, 2),
  }
}

function successFor(
  model: ModelNode,
  profile: WorkloadProfile,
): { successRate: number; successSignal: string } | null {
  for (const signal of profile.successSignals) {
    const value = model.benchmarks[signal]
    if (value != null && value >= MIN_USABLE_SUCCESS_RATE) {
      return { successRate: round(value, 4), successSignal: signal }
    }
  }
  return null
}

function latencyStatusFor(model: ModelNode, profile: WorkloadProfile): LatencyStatus {
  const limit = LATENCY_LIMITS[profile.latency]
  if (limit.maxTtftSeconds == null && limit.minTokensPerSecond == null) return "ok"

  const ttft = model.timeToFirstTokenSeconds
  const tps = model.outputTokensPerSecond
  if (ttft == null && tps == null) return "unknown"

  if (limit.maxTtftSeconds != null && ttft != null && ttft > limit.maxTtftSeconds) return "slow"
  if (limit.minTokensPerSecond != null && tps != null && tps < limit.minTokensPerSecond) return "slow"
  return "ok"
}

function rateModel(
  model: ModelNode,
  profile: WorkloadProfile,
  maxima: Map<QualitySignal, number>,
): ModelValue | null {
  const priceInputPerM = model.priceInputPerM
  const priceOutputPerM = model.priceOutputPerM
  if (priceInputPerM == null || priceOutputPerM == null) return null

  const rated = qualityFor(model, profile, maxima)
  if (!rated) return null

  const costPerTaskUsd =
    (profile.inputTokensPerTask / 1_000_000) * priceInputPerM +
    (profile.outputTokensPerTask / 1_000_000) * priceOutputPerM
  const success = successFor(model, profile)

  return {
    modelId: model.id,
    name: model.name,
    provider: model.provider.name,
    openWeight: isOpenWeight(model),
    priceInputPerM: round(priceInputPerM, 4),
    priceOutputPerM: round(priceOutputPerM, 4),
    costPerTaskUsd: round(costPerTaskUsd, 6),
    monthlyCostUsd: round(costPerTaskUsd * profile.monthlyTasks, 2),
    quality: rated.quality,
    coverage: rated.coverage,
    successRate: success?.successRate ?? null,
    successSignal: success?.successSignal ?? null,
    costPerSuccessUsd: success ? round(costPerTaskUsd / success.successRate, 6) : null,
    ttftSeconds: model.timeToFirstTokenSeconds != null ? round(model.timeToFirstTokenSeconds, 3) : null,
    tokensPerSecond: model.outputTokensPerSecond != null ? round(model.outputTokensPerSecond, 1) : null,
    latencyStatus: latencyStatusFor(model, profile),
  }
}

/** Effective cost used for ranking: per successful task when measurable, else per attempt. */
function effectiveCost(row: ModelValue): number {
  return row.costPerSuccessUsd ?? row.costPerTaskUsd
}

/** Cheaper-and-better domination on (effective cost, quality). */
function paretoFrontier(rows: ModelValue[]): ModelValue[] {
  const withSuccess = rows.filter((row) => row.costPerSuccessUsd != null)
  return withSuccess
    .filter((row) => {
      return !withSuccess.some((other) => {
        if (other.modelId === row.modelId) return false
        const cheaperOrEqual = effectiveCost(other) <= effectiveCost(row)
        const betterOrEqual = other.quality >= row.quality
        const strictlyBetter =
          effectiveCost(other) < effectiveCost(row) || other.quality > row.quality
        return cheaperOrEqual && betterOrEqual && strictlyBetter
      })
    })
    .sort((a, b) => effectiveCost(a) - effectiveCost(b))
}

/**
 * Collapses reasoning-effort variants of the same model (same provider, nearly
 * identical quality) down to the cheaper one, so the frontier reads as a list of
 * distinct choices instead of one model at four effort settings.
 */
function dedupeNearVariants(frontier: ModelValue[]): ModelValue[] {
  const MAX_QUALITY_TIE = 1.5
  const kept: ModelValue[] = []
  for (const row of frontier) {
    const duplicate = kept.some(
      (other) => other.provider === row.provider && Math.abs(other.quality - row.quality) < MAX_QUALITY_TIE,
    )
    if (!duplicate) kept.push(row)
  }
  return kept
}

/**
 * Kneedle-style knee: the frontier point furthest above the straight line joining
 * the cheapest and strongest points, with cost on a log axis because prices span
 * four orders of magnitude. This is where diminishing returns begin, which is what
 * "value for money" means in practice — not simply the cheapest option that passes.
 */
function kneePoint(frontier: ModelValue[]): ModelValue | null {
  if (frontier.length === 0) return null
  if (frontier.length <= 2) return frontier[0]

  const xs = frontier.map((row) => Math.log10(Math.max(effectiveCost(row), 1e-9)))
  const ys = frontier.map((row) => row.quality)
  const dx = xs[xs.length - 1] - xs[0]
  const dy = ys[ys.length - 1] - ys[0]
  const norm = Math.hypot(dx, dy)
  if (norm === 0) return frontier[0]

  let best = frontier[0]
  let bestDistance = -Infinity
  for (let i = 0; i < frontier.length; i += 1) {
    const distance = (dx * (ys[i] - ys[0]) - dy * (xs[i] - xs[0])) / norm
    if (distance > bestDistance) {
      bestDistance = distance
      best = frontier[i]
    }
  }
  return best
}

function analyzeWorkload(
  models: ModelNode[],
  profile: WorkloadProfile,
  maxima: Map<QualitySignal, number>,
): WorkloadValueAnalysis {
  const rated = models
    .map((model) => rateModel(model, profile, maxima))
    .filter((row): row is ModelValue => row !== null)

  const qualitySorted = rated.map((row) => row.quality).sort((a, b) => a - b)
  const qualityFloor = round(percentile(qualitySorted, profile.qualityFloorPercentile), 1)

  // Recommending an unmeasured model for an interactive workload risks a 20s TTFT,
  // so those profiles only pick from models with published latency.
  const requireMeasuredLatency = profile.latency === "interactive"
  const clearsLatency = (row: ModelValue) =>
    row.latencyStatus === "ok" || (row.latencyStatus === "unknown" && !requireMeasuredLatency)

  const eligible = rated.filter((row) => row.quality >= qualityFloor && clearsLatency(row))
  const eligibleFrontier = dedupeNearVariants(paretoFrontier(eligible))

  const bestValue = kneePoint(eligibleFrontier)
  const kneeIndex = bestValue ? eligibleFrontier.findIndex((row) => row.modelId === bestValue.modelId) : -1
  const runnerUp = kneeIndex >= 0 ? (eligibleFrontier[kneeIndex + 1] ?? null) : null
  const budget = [...eligible].sort((a, b) => a.costPerTaskUsd - b.costPerTaskUsd)[0] ?? null
  const premium =
    [...eligible].sort((a, b) => b.quality - a.quality || effectiveCost(a) - effectiveCost(b))[0] ?? null

  const premiumCostMultiple =
    premium?.costPerSuccessUsd != null && bestValue?.costPerSuccessUsd
      ? round(premium.costPerSuccessUsd / bestValue.costPerSuccessUsd, 2)
      : null

  // The instructive trap is not "cheap and weak" but "cheap per attempt, yet no
  // cheaper per delivered result once its success rate is priced in".
  const falseBargains = bestValue?.costPerSuccessUsd
    ? [...rated]
        .filter(
          (row) =>
            row.quality < qualityFloor &&
            row.costPerTaskUsd < bestValue.costPerTaskUsd &&
            row.costPerSuccessUsd != null &&
            row.costPerSuccessUsd >= bestValue.costPerSuccessUsd!,
        )
        .sort((a, b) => b.costPerSuccessUsd! - a.costPerSuccessUsd!)
        .slice(0, 3)
    : []

  const overpriced = bestValue
    ? [...rated]
        .filter((row) => row.quality < bestValue.quality && row.costPerTaskUsd > bestValue.costPerTaskUsd)
        .sort((a, b) => b.costPerTaskUsd - a.costPerTaskUsd)
        .slice(0, 3)
    : []

  return {
    workloadId: profile.id,
    inputTokensPerTask: profile.inputTokensPerTask,
    outputTokensPerTask: profile.outputTokensPerTask,
    tokenRatio: tokenRatioLabel(profile),
    monthlyTasks: profile.monthlyTasks,
    ratedCount: rated.length,
    eligibleCount: eligible.length,
    unmeasuredLatencyCount: requireMeasuredLatency
      ? rated.filter((row) => row.quality >= qualityFloor && row.latencyStatus === "unknown").length
      : 0,
    qualityFloor,
    qualityFloorPercentile: profile.qualityFloorPercentile,
    qualityFloorTopPercent: Math.round((1 - profile.qualityFloorPercentile) * 100),
    latencyClass: profile.latency,
    bestValue,
    runnerUp,
    budget,
    premium,
    premiumCostMultiple,
    premiumQualityGain:
      premium && bestValue ? round(premium.quality - bestValue.quality, 1) : null,
    frontier: eligibleFrontier.slice(0, 8),
    falseBargains,
    overpriced,
  }
}

/**
 * For each workload, pairs the priciest top-quality model with the cheapest
 * model that stays within a few quality points of it.
 */
function buildSubstitutions(analyses: WorkloadValueAnalysis[]): Substitution[] {
  const MAX_QUALITY_DROP = 5
  const substitutions: Substitution[] = []

  for (const analysis of analyses) {
    const { premium, frontier } = analysis
    if (!premium) continue

    const alternative = frontier.find(
      (row) =>
        row.modelId !== premium.modelId &&
        premium.quality - row.quality <= MAX_QUALITY_DROP &&
        row.monthlyCostUsd < premium.monthlyCostUsd,
    )
    if (!alternative || premium.monthlyCostUsd <= 0) continue

    substitutions.push({
      workloadId: analysis.workloadId,
      expensiveId: premium.modelId,
      expensive: premium.name,
      expensiveMonthlyCostUsd: premium.monthlyCostUsd,
      alternativeId: alternative.modelId,
      alternative: alternative.name,
      alternativeMonthlyCostUsd: alternative.monthlyCostUsd,
      savingsPercent: round(
        ((premium.monthlyCostUsd - alternative.monthlyCostUsd) / premium.monthlyCostUsd) * 100,
        1,
      ),
      qualityDelta: round(alternative.quality - premium.quality, 1),
    })
  }

  return substitutions
}

export function analyzeValue(models: ModelNode[]): ValueAnalysis {
  const maxima = signalMaxima(models)
  const priced = models.filter(
    (model) => model.priceInputPerM != null && model.priceOutputPerM != null,
  )
  const workloads = WORKLOAD_PROFILE_LIST.map((profile) => analyzeWorkload(models, profile, maxima))

  const unpricedWatchlist = models
    .filter(
      (model) =>
        (model.priceInputPerM == null || model.priceOutputPerM == null) &&
        isOpenWeight(model) &&
        model.intelligenceIndex != null,
    )
    .sort((a, b) => (b.intelligenceIndex ?? 0) - (a.intelligenceIndex ?? 0))
    .slice(0, 8)
    .map((model) => ({
      modelId: model.id,
      name: model.name,
      provider: model.provider.name,
      openWeight: true,
      intelligenceIndex: model.intelligenceIndex != null ? round(model.intelligenceIndex, 1) : null,
      codingIndex: model.codingIndex != null ? round(model.codingIndex, 1) : null,
    }))

  return {
    workloads,
    pricedModelCount: priced.length,
    unpricedModelCount: models.length - priced.length,
    substitutions: buildSubstitutions(workloads),
    unpricedWatchlist,
  }
}
