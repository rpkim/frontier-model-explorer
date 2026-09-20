import { get, put } from "@vercel/blob"
import { CATALOG_FIELD_LEGEND, serializeCatalogForAgent } from "./catalog-for-agent"
import { isOpenWeight } from "./filter"
import type { ValueAnalysis } from "./value"
import { WORKLOAD_IDS, type WorkloadId } from "./workloads"
import type { CatalogChangelog } from "./changelog"
import { LANGUAGE_NAMES, LOCALES, type Locale } from "@/lib/i18n/locales"
import type { CatalogReport, ModelNode } from "./types"

/** Legacy single-report path, kept so reports written before per-locale storage still load. */
export const REPORT_BLOB_PATHNAME = "frontier-models/reports/latest.json"
export const REPORT_MODEL_ID = "gemini-3.5-flash"

export function reportBlobPathname(locale: Locale): string {
  return `frontier-models/reports/${locale}.json`
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function compactNamed(model: ModelNode) {
  return {
    n: model.name,
    p: model.provider.name,
    i: model.intelligenceIndex != null ? round(model.intelligenceIndex, 1) : null,
    c: model.codingIndex != null ? round(model.codingIndex, 1) : null,
    pbl: model.priceBlendedPerM != null ? round(model.priceBlendedPerM, 4) : null,
    tps: model.outputTokensPerSecond != null ? round(model.outputTokensPerSecond, 1) : null,
    d: model.releaseDate,
    ow: isOpenWeight(model) ? 1 : 0,
  }
}

function paretoByPrice(models: ModelNode[]): ModelNode[] {
  const pts = models.filter(
    (model) => model.intelligenceIndex != null && model.priceBlendedPerM != null,
  )
  return pts
    .filter((model) => {
      return !pts.some((other) => {
        if (other === model) return false
        const betterOrEqualIntel = other.intelligenceIndex! >= model.intelligenceIndex!
        const betterOrEqualPrice = other.priceBlendedPerM! <= model.priceBlendedPerM!
        const strictlyBetter =
          other.intelligenceIndex! > model.intelligenceIndex! ||
          other.priceBlendedPerM! < model.priceBlendedPerM!
        return betterOrEqualIntel && betterOrEqualPrice && strictlyBetter
      })
    })
    .sort((a, b) => a.priceBlendedPerM! - b.priceBlendedPerM!)
}

function topBy(
  models: ModelNode[],
  pick: (model: ModelNode) => number | null,
  direction: "desc" | "asc",
  limit: number,
) {
  return models
    .map((model) => ({ model, value: pick(model) }))
    .filter((row): row is { model: ModelNode; value: number } => row.value != null)
    .sort((a, b) => (direction === "desc" ? b.value - a.value : a.value - b.value))
    .slice(0, limit)
    .map((row) => compactNamed(row.model))
}

export function summarizeCatalog(models: ModelNode[]) {
  const providers = new Set(models.map((model) => model.provider.name))
  const openWeightCount = models.filter(isOpenWeight).length
  const intelligence = models
    .map((model) => model.intelligenceIndex)
    .filter((value): value is number => value != null)
  const prices = models
    .map((model) => model.priceBlendedPerM)
    .filter((value): value is number => value != null)
  const speeds = models
    .map((model) => model.outputTokensPerSecond)
    .filter((value): value is number => value != null)
  const dates = models
    .map((model) => model.releaseDate)
    .filter((value): value is string => Boolean(value))
    .sort()

  return {
    modelCount: models.length,
    providerCount: providers.size,
    openWeightCount,
    proprietaryCount: models.length - openWeightCount,
    intelligence: {
      n: intelligence.length,
      min: intelligence.length ? round(Math.min(...intelligence), 1) : null,
      median: intelligence.length ? round(median(intelligence)!, 1) : null,
      max: intelligence.length ? round(Math.max(...intelligence), 1) : null,
    },
    blendedPriceUsdPerM: {
      n: prices.length,
      min: prices.length ? round(Math.min(...prices), 4) : null,
      median: prices.length ? round(median(prices)!, 4) : null,
      max: prices.length ? round(Math.max(...prices), 4) : null,
    },
    outputTokPerSec: {
      n: speeds.length,
      min: speeds.length ? round(Math.min(...speeds), 1) : null,
      median: speeds.length ? round(median(speeds)!, 1) : null,
      max: speeds.length ? round(Math.max(...speeds), 1) : null,
    },
    releaseDateRange: dates.length ? { earliest: dates[0], latest: dates[dates.length - 1] } : null,
    priceIntelligencePareto: paretoByPrice(models).map(compactNamed),
    strongestIntelligence: topBy(models, (model) => model.intelligenceIndex, "desc", 8),
    strongestCoding: topBy(models, (model) => model.codingIndex, "desc", 8),
    fastest: topBy(models, (model) => model.outputTokensPerSecond, "desc", 8),
    newest: topBy(models, (model) => (model.releaseDate ? Date.parse(model.releaseDate) : null), "desc", 8),
  }
}

export function unwrapMarkdown(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/)
  return (fenced ? fenced[1] : trimmed).trim()
}

export function isCatalogReport(value: unknown): value is CatalogReport {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.generatedAt === "string" &&
    typeof row.locale === "string" &&
    typeof row.markdown === "string" &&
    typeof row.modelCount === "number" &&
    typeof row.model === "string" &&
    typeof row.snapshotSyncedAt === "string"
  )
}

async function readReportAt(pathname: string): Promise<CatalogReport | null> {
  try {
    const result = await get(pathname, { access: "private" })
    if (!result) return null
    const text = await new Response(result.stream).text()
    const parsed: unknown = JSON.parse(text)
    return isCatalogReport(parsed) ? parsed : null
  } catch (error) {
    console.error("Failed to read report from Blob:", error)
    return null
  }
}

/**
 * Reports are stored per locale so that generating an English report no longer
 * overwrites the Korean one. Falls back to the legacy shared path only when the
 * report stored there was written in the requested language.
 */
export async function readReport(locale: Locale): Promise<CatalogReport | null> {
  const current = await readReportAt(reportBlobPathname(locale))
  if (current) return current

  const legacy = await readReportAt(REPORT_BLOB_PATHNAME)
  return legacy?.locale === locale ? legacy : null
}

export async function writeReport(report: CatalogReport): Promise<CatalogReport> {
  const locale = LOCALES.find((code) => code === report.locale)
  await put(reportBlobPathname(locale ?? "en"), JSON.stringify(report), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return report
}

const VALUE_FIELD_LEGEND = [
  "Each workload is a realistic task profile with its own input:output token mix, because a single blended 3:1 price misprices retrieval (input-heavy) and reasoning (output-heavy) work",
  "inputTokensPerTask / outputTokensPerTask / monthlyTasks = the assumed workload; monthlyCostUsd is costPerTaskUsd x monthlyTasks",
  "quality = weighted score 0-100 over that workload's benchmarks, normalized against the strongest model in this snapshot",
  "coverage = fraction of the workload's quality signals that had data for that model; below 1.0 the score rests on partial evidence",
  "successRate / successSignal = pass rate on the named benchmark, used as a reliability proxy",
  "costPerSuccessUsd = costPerTaskUsd / successRate, the cost of one delivered result rather than one attempt",
  "qualityFloor = minimum quality to be recommendable for that workload, set at the stated percentile of rated models",
  "bestValue = knee of the cost/quality frontier, where paying more stops buying much quality",
  "runnerUp = the next step up the frontier; budget = cheapest model still above the floor; premium = highest quality that meets the latency class",
  "premiumCostMultiple / premiumQualityGain = what the jump from bestValue to premium costs and buys",
  "falseBargains = cheaper per attempt than bestValue yet no cheaper per successful task",
  "overpriced = costs more than bestValue while scoring lower: strictly dominated",
  "latencyStatus = ok | unknown | slow against the workload's latency class",
  "unmeasuredLatencyCount = models excluded from an interactive workload because their latency is unpublished",
].join("; ")

/** Natural-language names for the workload ids, so the report never echoes the raw identifiers. */
const WORKLOAD_PROMPT_NAMES: Record<WorkloadId, string> = {
  chat: "customer-facing chat",
  rag: "document question answering and retrieval (RAG)",
  toolAgent: "tool-using agent",
  codingAgent: "coding agent",
  reasoning: "hard reasoning and research",
  bulkExtraction: "bulk classification and extraction",
}

/** Section 3 is generated per workload so the instruction stays in sync with the profiles. */
function workloadSectionInstruction(): string {
  return WORKLOAD_IDS.map(
    (id, index) =>
      `3.${index + 1} H3 titled with the translated name of "${WORKLOAD_PROMPT_NAMES[id]}", using the entry whose workloadId is "${id}"`,
  ).join("; ")
}

export function buildReportPrompt({
  models,
  syncedAt,
  locale,
  changelog,
  valueAnalysis,
}: {
  models: ModelNode[]
  syncedAt: string
  locale: Locale
  changelog: CatalogChangelog | null
  valueAnalysis: ValueAnalysis
}): {
  system: string
  prompt: string
  valueAnalysis: ValueAnalysis
  catalogRows: Record<string, unknown>[]
  summary: ReturnType<typeof summarizeCatalog>
} {
  const catalog = serializeCatalogForAgent(models)
  const summary = summarizeCatalog(models)
  const value = valueAnalysis
  const truncationNote = catalog.truncatedFields
    ? `Per-model benchmark scores (field b) were omitted so all ${catalog.modelCount} models could fit. Indexes, prices, speed, open-weight flags, and release dates are still present.`
    : `The catalog includes all ${catalog.modelCount} models with available indexes, prices, speed, and benchmark scores.`

  const system = [
    "You are the catalog analyst for Frontier Model Explorer.",
    "Write a scannable briefing from ONLY the Artificial Analysis snapshot catalog and the precomputed JSON below.",
    "Do not invent models, providers, scores, prices, dates, or labs that are not in the data.",
    "If a value is missing, say it is unknown in this snapshot. Never fabricate numbers.",
    "CRITICAL: every number you print must be copied verbatim from the precomputed JSON or the catalog. Do not add, divide, average, convert, or otherwise derive figures yourself — the value analysis has already been computed for you. Your job is to explain what those numbers mean for a reader choosing a model.",
    "Never print JSON field names, workload ids, or camelCase identifiers in the report. Refer to each concept by a natural phrase in the target language instead.",
    "Prefix every monetary figure with $ and keep the precision given in the JSON.",
    "Prefer tables, short bullets, and 1–3 blockquote callouts over long prose.",
    "The app already renders a decision brief, per-task value tables, substitutions, and a what-changed panel from this JSON. Do not reprint those tables. Your job is interpretation: why the pick is the pick, when a swap is a bad idea, and what the catalog movement means.",
    `Write the entire report in ${LANGUAGE_NAMES[locale]}, including every section title. Do not mix in words from any other language except model, provider, and benchmark names, which stay as written in the catalog.`,
    `Snapshot synced at: ${syncedAt}. Catalog size: ${catalog.modelCount} models.`,
    truncationNote,
    `Catalog field legend: ${CATALOG_FIELD_LEGEND}.`,
    `Value analysis legend: ${VALUE_FIELD_LEGEND}.`,
    "Precomputed summary JSON (use these figures for the executive snapshot):",
    JSON.stringify(summary),
    "Precomputed value analysis JSON:",
    JSON.stringify(value),
    changelog
      ? `Precomputed changelog JSON (the only source for the what-changed section):\n${JSON.stringify(changelog)}`
      : "No previous baseline exists for this catalog — omit the what-changed section.",
    "Catalog JSON:",
    catalog.json,
  ].join("\n")

  const prompt = [
    "Write a GitHub-flavored markdown catalog report with this section order. Do not wrap the document in a code fence.",
    "",
    "1. H1 title — short, specific to this snapshot.",
    "2. H2 Executive snapshot — a compact markdown table of 4–6 headline stats (metric | value), then one short paragraph that states the decision: for most teams the knee of the frontier is the buy; paying up to premium is only worth it when the quality gain is named.",
    "3. H2 Why these picks — one short paragraph per workload from valueAnalysis.workloads, in the given order:",
    `   ${workloadSectionInstruction()}.`,
    "   Each paragraph names bestValue, what premiumCostMultiple buys in premiumQualityGain points, and one trap from falseBargains or overpriced. No tables. Mention coverage below 1.0 or unpublished latency when it affects trust.",
    "4. H2 When not to switch — using substitutions, one sentence per row on the case where keeping the expensive model is still right (regulated eval suites, unpublished latency, quality floor for that workload). No table.",
    changelog
      ? "5. H2 What changed — narrate the changelog JSON in bullets: new/retired models, the largest price moves, and any workload whose best-value pick changed. Copy the names and percents from the JSON."
      : "5. Omit any what-changed heading — there is no previous baseline.",
    "6. H2 Trends — H3 new/rising labs; H3 open vs closed using field ow (1 = open-weight heuristic, 0 = proprietary); H3 price, speed, and intelligence shifts by release cohort when dates exist.",
    "7. H2 Other standouts — H3 fastest; H3 strongest intelligence; H3 coding standouts; H3 unpriced open-weight watchlist from valueAnalysis.unpricedWatchlist (these have no API price — they are self-hosting candidates, not free); H3 notable gaps or missing data.",
    "8. H2 Method and caveats — a short bullet list: the token mixes are assumptions, not measurements from your traffic; quality is normalized against the strongest model in this snapshot, so scores move as the catalog grows; success rates are benchmark pass rates standing in for production reliability; prices exclude prompt caching, batch discounts, and committed-use pricing, which matter most for the input-heavy workloads; latency is unpublished for most models, which only excludes them from the interactive workload; the open-weight flag is a heuristic; state pricedModelCount and unpricedModelCount from the value analysis.",
    "",
    "Translate every heading into the target language. Be specific: always name real models from the catalog. Keep it scannable — about 900–1400 words, bullets over essays. Do not reprint the decision brief or the per-task cost tables.",
  ].join("\n")

  return { system, prompt, valueAnalysis: value, catalogRows: catalog.rows, summary }
}
