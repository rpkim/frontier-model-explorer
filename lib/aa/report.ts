import { get, put } from "@vercel/blob"
import { CATALOG_FIELD_LEGEND, serializeCatalogForAgent } from "./catalog-for-agent"
import { isOpenWeight } from "./filter"
import type { Locale } from "@/lib/i18n/locales"
import type { CatalogReport, ModelNode } from "./types"

export const REPORT_BLOB_PATHNAME = "frontier-models/reports/latest.json"
export const REPORT_MODEL_ID = "gemini-3.5-flash"

const REPORT_LANGUAGE: Record<Locale, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  zh: "Simplified Chinese",
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

export async function readReport(): Promise<CatalogReport | null> {
  try {
    const result = await get(REPORT_BLOB_PATHNAME, { access: "private" })
    if (!result) return null
    const text = await new Response(result.stream).text()
    const parsed: unknown = JSON.parse(text)
    return isCatalogReport(parsed) ? parsed : null
  } catch (error) {
    console.error("[v0] Failed to read report from Blob:", error)
    return null
  }
}

export async function writeReport(report: CatalogReport): Promise<CatalogReport> {
  await put(REPORT_BLOB_PATHNAME, JSON.stringify(report), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return report
}

export function buildReportPrompt({
  models,
  syncedAt,
  locale,
}: {
  models: ModelNode[]
  syncedAt: string
  locale: Locale
}): { system: string; prompt: string } {
  const catalog = serializeCatalogForAgent(models)
  const summary = summarizeCatalog(models)
  const truncationNote = catalog.truncatedFields
    ? `Per-model benchmark scores (field b) were omitted so all ${catalog.modelCount} models could fit. Indexes, prices, speed, open-weight flags, and release dates are still present.`
    : `The catalog includes all ${catalog.modelCount} models with available indexes, prices, speed, and benchmark scores.`

  const system = [
    "You are the catalog analyst for Frontier Model Explorer.",
    "Write a scannable briefing from ONLY the Artificial Analysis snapshot catalog and the precomputed summary below.",
    "Do not invent models, providers, scores, prices, dates, or labs that are not in the data.",
    "If a value is missing, say it is unknown in this snapshot. Never fabricate numbers.",
    "Prefer tables, short bullets, and 1–3 blockquote callouts over long prose.",
    `Write the entire report in ${REPORT_LANGUAGE[locale]}. Translate section titles into that language.`,
    `Snapshot synced at: ${syncedAt}. Catalog size: ${catalog.modelCount} models.`,
    truncationNote,
    `Field legend: ${CATALOG_FIELD_LEGEND}.`,
    "Precomputed summary JSON (use these figures for the executive snapshot; they are derived from the catalog):",
    JSON.stringify(summary),
    "Catalog JSON:",
    catalog.json,
  ].join("\n")

  const prompt = [
    "Write a GitHub-flavored markdown catalog report with this section order. Do not wrap the document in a code fence.",
    "",
    "1. H1 title — short, specific to this snapshot.",
    "2. H2 Executive snapshot — a compact markdown table of 4–6 headline stats (metric | value), then one short interpretation paragraph.",
    "3. H2 Best value-for-money — 가성비 / cheap-for-intelligence. Use the price-intelligence Pareto list as the backbone, not merely the cheapest models. Table columns: Model | Provider | Intelligence | Blended $/1M | Why. Pick 5–8 named models and explain why each is (or is not) a good deal. Add a short bullet list of traps (expensive for the score, cheap but weak, missing price).",
    "4. H2 Trends — H3 new/rising labs; H3 open vs closed using field ow (1 = open-weight heuristic, 0 = proprietary); H3 price, speed, and intelligence shifts by release cohort when dates exist.",
    "5. H2 Other standouts — H3 fastest; H3 strongest intelligence; H3 coding standouts; H3 notable gaps or missing data.",
    "6. H2 How to read this — short caveats: snapshot date, missing prices/scores, open-weight flag is a heuristic.",
    "",
    "Be specific: always name real models from the catalog. Keep the report easy to scan on a laptop — about 800–1400 words, tables and bullets over essays.",
  ].join("\n")

  return { system, prompt }
}
