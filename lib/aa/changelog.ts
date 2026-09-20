/**
 * Snapshot-over-snapshot diff for the report.
 *
 * A single-snapshot briefing is a data dump. What makes a recurring report worth
 * reading is the delta: who entered the catalog, which prices moved, and where the
 * recommendation changed as a result. All of it is computed here rather than asked
 * of the model, for the same reason the value math is — it has to be reproducible.
 *
 * The comparison baseline is stored separately from the reports themselves and is
 * language-independent, so generating the same snapshot in a second language diffs
 * against the same earlier snapshot instead of against its own translation.
 */

import { isOpenWeight } from "./filter"
import { readJsonBlob, writeJsonBlob } from "./blob-json"
import type { ValueAnalysis } from "./value"
import { WORKLOAD_IDS, type WorkloadId } from "./workloads"
import type { ModelNode } from "./types"

export const REPORT_BASELINE_PATHNAME = "frontier-models/reports/baseline.json"

/** Price moves smaller than this are rounding noise, not news. */
const MIN_PRICE_CHANGE_PERCENT = 1

const MAX_LISTED_MODELS = 8
const MAX_LISTED_PRICE_CHANGES = 10

interface BaselineModel {
  name: string
  provider: string
  priceInputPerM: number | null
  priceOutputPerM: number | null
  intelligenceIndex: number | null
  releaseDate: string | null
}

interface BaselineWorkload {
  bestValueId: string | null
  frontierIds: string[]
}

export interface ReportBaseline {
  generatedAt: string
  snapshotSyncedAt: string
  models: Record<string, BaselineModel>
  workloads: Partial<Record<WorkloadId, BaselineWorkload>>
}

export interface ModelSummary {
  name: string
  provider: string
  intelligenceIndex: number | null
  releaseDate: string | null
  openWeight: boolean
}

export interface PriceChange {
  name: string
  provider: string
  /** Which side of the price moved; the two often move independently. */
  side: "input" | "output"
  fromUsdPerM: number
  toUsdPerM: number
  changePercent: number
}

export interface WorkloadShift {
  workloadId: WorkloadId
  previousBestValue: string | null
  bestValue: string | null
  /** Models that joined the cost/quality frontier for this workload. */
  entered: string[]
  exited: string[]
}

export interface CatalogChangelog {
  previousGeneratedAt: string
  previousSnapshotSyncedAt: string
  newModels: ModelSummary[]
  newModelCount: number
  retiredModels: ModelSummary[]
  retiredModelCount: number
  priceChanges: PriceChange[]
  priceChangeCount: number
  workloadShifts: WorkloadShift[]
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function buildReportBaseline({
  models,
  analysis,
  generatedAt,
  snapshotSyncedAt,
}: {
  models: ModelNode[]
  analysis: ValueAnalysis
  generatedAt: string
  snapshotSyncedAt: string
}): ReportBaseline {
  const baselineModels: Record<string, BaselineModel> = {}
  for (const model of models) {
    baselineModels[model.id] = {
      name: model.name,
      provider: model.provider.name,
      priceInputPerM: model.priceInputPerM != null ? round(model.priceInputPerM, 4) : null,
      priceOutputPerM: model.priceOutputPerM != null ? round(model.priceOutputPerM, 4) : null,
      intelligenceIndex: model.intelligenceIndex != null ? round(model.intelligenceIndex, 1) : null,
      releaseDate: model.releaseDate ?? null,
    }
  }

  const workloads: Partial<Record<WorkloadId, BaselineWorkload>> = {}
  for (const workload of analysis.workloads) {
    workloads[workload.workloadId] = {
      bestValueId: workload.bestValue?.modelId ?? null,
      frontierIds: workload.frontier.map((row) => row.modelId),
    }
  }

  return { generatedAt, snapshotSyncedAt, models: baselineModels, workloads }
}

function summarize(model: ModelNode): ModelSummary {
  return {
    name: model.name,
    provider: model.provider.name,
    intelligenceIndex: model.intelligenceIndex != null ? round(model.intelligenceIndex, 1) : null,
    releaseDate: model.releaseDate ?? null,
    openWeight: isOpenWeight(model),
  }
}

function priceChangesFor(
  model: ModelNode,
  previous: BaselineModel,
): PriceChange[] {
  const sides: { side: "input" | "output"; from: number | null; to: number | null }[] = [
    { side: "input", from: previous.priceInputPerM, to: model.priceInputPerM ?? null },
    { side: "output", from: previous.priceOutputPerM, to: model.priceOutputPerM ?? null },
  ]

  const changes: PriceChange[] = []
  for (const { side, from, to } of sides) {
    if (from == null || to == null || from <= 0) continue
    const changePercent = round(((to - from) / from) * 100, 1)
    if (Math.abs(changePercent) < MIN_PRICE_CHANGE_PERCENT) continue
    changes.push({
      name: model.name,
      provider: model.provider.name,
      side,
      fromUsdPerM: round(from, 4),
      toUsdPerM: round(to, 4),
      changePercent,
    })
  }
  return changes
}

function byIntelligenceDesc(a: ModelSummary, b: ModelSummary): number {
  return (b.intelligenceIndex ?? -1) - (a.intelligenceIndex ?? -1)
}

/**
 * Returns null when there is nothing meaningful to report, so the report can omit
 * the section rather than print an empty one.
 */
export function diffAgainstBaseline({
  baseline,
  models,
  analysis,
}: {
  baseline: ReportBaseline
  models: ModelNode[]
  analysis: ValueAnalysis
}): CatalogChangelog | null {
  const current = new Map(models.map((model) => [model.id, model]))

  const newModels: ModelSummary[] = []
  const priceChanges: PriceChange[] = []
  for (const model of models) {
    const previous = baseline.models[model.id]
    if (!previous) {
      newModels.push(summarize(model))
      continue
    }
    priceChanges.push(...priceChangesFor(model, previous))
  }

  const retiredModels: ModelSummary[] = []
  for (const [modelId, previous] of Object.entries(baseline.models)) {
    if (current.has(modelId)) continue
    retiredModels.push({
      name: previous.name,
      provider: previous.provider,
      intelligenceIndex: previous.intelligenceIndex,
      releaseDate: previous.releaseDate,
      openWeight: false,
    })
  }

  const nameFor = (modelId: string): string =>
    current.get(modelId)?.name ?? baseline.models[modelId]?.name ?? modelId

  const workloadShifts: WorkloadShift[] = []
  for (const workloadId of WORKLOAD_IDS) {
    const previous = baseline.workloads[workloadId]
    const now = analysis.workloads.find((row) => row.workloadId === workloadId)
    if (!previous || !now) continue

    const previousIds = new Set(previous.frontierIds)
    const currentIds = new Set(now.frontier.map((row) => row.modelId))
    const entered = now.frontier
      .filter((row) => !previousIds.has(row.modelId))
      .map((row) => row.name)
    const exited = previous.frontierIds.filter((id) => !currentIds.has(id)).map(nameFor)

    const bestValueId = now.bestValue?.modelId ?? null
    const pickChanged = previous.bestValueId !== bestValueId
    if (!pickChanged && entered.length === 0 && exited.length === 0) continue

    workloadShifts.push({
      workloadId,
      previousBestValue: previous.bestValueId ? nameFor(previous.bestValueId) : null,
      bestValue: now.bestValue?.name ?? null,
      entered,
      exited,
    })
  }

  const empty =
    newModels.length === 0 &&
    retiredModels.length === 0 &&
    priceChanges.length === 0 &&
    workloadShifts.length === 0
  if (empty) return null

  priceChanges.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
  newModels.sort(byIntelligenceDesc)
  retiredModels.sort(byIntelligenceDesc)

  return {
    previousGeneratedAt: baseline.generatedAt,
    previousSnapshotSyncedAt: baseline.snapshotSyncedAt,
    newModels: newModels.slice(0, MAX_LISTED_MODELS),
    newModelCount: newModels.length,
    retiredModels: retiredModels.slice(0, MAX_LISTED_MODELS),
    retiredModelCount: retiredModels.length,
    priceChanges: priceChanges.slice(0, MAX_LISTED_PRICE_CHANGES),
    priceChangeCount: priceChanges.length,
    workloadShifts,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isReportBaseline(value: unknown): value is ReportBaseline {
  if (!isRecord(value)) return false
  return (
    typeof value.generatedAt === "string" &&
    typeof value.snapshotSyncedAt === "string" &&
    isRecord(value.models) &&
    isRecord(value.workloads)
  )
}

export async function readReportBaseline(): Promise<ReportBaseline | null> {
  const parsed = await readJsonBlob(REPORT_BASELINE_PATHNAME)
  return isReportBaseline(parsed) ? parsed : null
}

export async function writeReportBaseline(baseline: ReportBaseline): Promise<void> {
  await writeJsonBlob(REPORT_BASELINE_PATHNAME, baseline)
}
