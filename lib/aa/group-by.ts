import type { ModelNode } from "./types"
import type { MessageKey } from "@/lib/i18n/translate"

export type GroupByKey = "provider" | "intelligence" | "price" | "speed" | "release"

export const GROUP_BY_OPTIONS: { key: GroupByKey; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { key: "provider", labelKey: "groupBy.provider", hintKey: "groupBy.providerHint" },
  { key: "intelligence", labelKey: "groupBy.intelligence", hintKey: "groupBy.intelligenceHint" },
  { key: "price", labelKey: "groupBy.price", hintKey: "groupBy.priceHint" },
  { key: "speed", labelKey: "groupBy.speed", hintKey: "groupBy.speedHint" },
  { key: "release", labelKey: "groupBy.release", hintKey: "groupBy.releaseHint" },
]

export interface Group {
  /** Stable identifier used in the URL and as a React key */
  id: string
  /** Short label shown on the node when `labelKey` is not set (e.g. provider name) */
  label: string
  /** i18n key; when set, the UI translates this instead of showing `label` */
  labelKey?: MessageKey
  /** Optional secondary label, e.g. a score range */
  sublabel?: string
  models: ModelNode[]
  /** Sort weight — lower sorts first */
  order: number
}

const UNKNOWN_ORDER = 999

function sortGroups(groups: Group[]): Group[] {
  return groups.sort((a, b) => a.order - b.order || b.models.length - a.models.length)
}

export function groupByProvider(models: ModelNode[]): Group[] {
  const byProvider = new Map<string, ModelNode[]>()
  for (const m of models) {
    const key = m.provider.slug
    const list = byProvider.get(key) ?? []
    list.push(m)
    byProvider.set(key, list)
  }
  const groups: Group[] = Array.from(byProvider.entries()).map(([slug, list]) => ({
    id: slug,
    label: list[0].provider.name,
    models: list,
    order: 0,
  }))
  return groups.sort((a, b) => b.models.length - a.models.length)
}

interface Bucket {
  id: string
  label: string
  labelKey?: MessageKey
  order: number
  test: (m: ModelNode) => boolean
}

function bucketGroups(models: ModelNode[], buckets: Bucket[]): Group[] {
  const groups: Group[] = buckets.map((b) => ({
    id: b.id,
    label: b.label,
    labelKey: b.labelKey,
    models: [],
    order: b.order,
  }))
  for (const m of models) {
    const idx = buckets.findIndex((b) => b.test(m))
    groups[idx === -1 ? buckets.length - 1 : idx].models.push(m)
  }
  return sortGroups(groups.filter((g) => g.models.length > 0))
}

export function groupByIntelligence(models: ModelNode[]): Group[] {
  const tiers: { min: number; labelKey: MessageKey }[] = [
    { min: 60, labelKey: "groups.intel60" },
    { min: 50, labelKey: "groups.intel50" },
    { min: 40, labelKey: "groups.intel40" },
    { min: 30, labelKey: "groups.intel30" },
    { min: 20, labelKey: "groups.intel20" },
    { min: 10, labelKey: "groups.intel10" },
    { min: 0, labelKey: "groups.intel0" },
  ]
  const buckets: Bucket[] = tiers.map(({ min, labelKey }, i) => ({
    id: `intel-${min}`,
    label: labelKey,
    labelKey,
    order: i,
    test: (m) => m.intelligenceIndex !== null && m.intelligenceIndex >= min,
  }))
  buckets.push({
    id: "intel-unknown",
    label: "groups.intelUnknown",
    labelKey: "groups.intelUnknown",
    order: UNKNOWN_ORDER,
    test: () => true,
  })
  return bucketGroups(models, buckets)
}

export function groupByPrice(models: ModelNode[]): Group[] {
  const tiers: { min: number; labelKey: MessageKey }[] = [
    { min: 0, labelKey: "groups.price0" },
    { min: 0.5, labelKey: "groups.price05" },
    { min: 2, labelKey: "groups.price2" },
    { min: 5, labelKey: "groups.price5" },
    { min: 15, labelKey: "groups.price15" },
    { min: 50, labelKey: "groups.price50" },
  ]
  const buckets: Bucket[] = tiers
    .map(({ min, labelKey }, i) => ({
      id: `price-${min}`,
      label: labelKey,
      labelKey,
      order: i,
      test: (m: ModelNode) => m.priceBlendedPerM !== null && m.priceBlendedPerM >= min,
    }))
    .reverse() // check highest threshold first
  buckets.push({
    id: "price-unknown",
    label: "groups.priceUnknown",
    labelKey: "groups.priceUnknown",
    order: UNKNOWN_ORDER,
    test: () => true,
  })
  return bucketGroups(models, buckets)
}

export function groupBySpeed(models: ModelNode[]): Group[] {
  const tiers: { min: number; labelKey: MessageKey }[] = [
    { min: 600, labelKey: "groups.speed600" },
    { min: 300, labelKey: "groups.speed300" },
    { min: 150, labelKey: "groups.speed150" },
    { min: 75, labelKey: "groups.speed75" },
    { min: 0, labelKey: "groups.speed0" },
  ]
  const buckets: Bucket[] = tiers.map(({ min, labelKey }, i) => ({
    id: `speed-${min}`,
    label: labelKey,
    labelKey,
    order: i,
    test: (m) => m.outputTokensPerSecond !== null && m.outputTokensPerSecond >= min,
  }))
  buckets.push({
    id: "speed-unknown",
    label: "groups.speedUnknown",
    labelKey: "groups.speedUnknown",
    order: UNKNOWN_ORDER,
    test: () => true,
  })
  return bucketGroups(models, buckets)
}

function quarterOf(dateStr: string): { key: string; label: string; sortKey: number } {
  const d = new Date(dateStr)
  const year = d.getUTCFullYear()
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1
  return { key: `${year}-Q${quarter}`, label: `${year} Q${quarter}`, sortKey: year * 4 + quarter }
}

export function groupByRelease(models: ModelNode[]): Group[] {
  const map = new Map<string, { label: string; models: ModelNode[]; sortKey: number }>()
  const unknown: ModelNode[] = []
  for (const m of models) {
    if (!m.releaseDate) {
      unknown.push(m)
      continue
    }
    const { key, label, sortKey } = quarterOf(m.releaseDate)
    const entry = map.get(key) ?? { label, models: [], sortKey }
    entry.models.push(m)
    map.set(key, entry)
  }
  const groups: Group[] = Array.from(map.entries()).map(([key, entry]) => ({
    id: key,
    label: entry.label,
    models: entry.models,
    order: -entry.sortKey, // most recent first
  }))
  if (unknown.length > 0) {
    groups.push({
      id: "release-unknown",
      label: "groups.releaseUnknown",
      labelKey: "groups.releaseUnknown",
      models: unknown,
      order: UNKNOWN_ORDER,
    })
  }
  return sortGroups(groups)
}

export function groupModels(by: GroupByKey, models: ModelNode[]): Group[] {
  switch (by) {
    case "provider":
      return groupByProvider(models)
    case "intelligence":
      return groupByIntelligence(models)
    case "price":
      return groupByPrice(models)
    case "speed":
      return groupBySpeed(models)
    case "release":
      return groupByRelease(models)
  }
}

/** The metric value + formatted label to emphasize on a model card for a given grouping axis. */
export function highlightMetricFor(
  by: GroupByKey,
  model: ModelNode,
): { labelKey: MessageKey; value: string } | null {
  switch (by) {
    case "intelligence":
      return model.intelligenceIndex !== null
        ? { labelKey: "highlight.intelligenceIndex", value: model.intelligenceIndex.toFixed(1) }
        : null
    case "price":
      return model.priceBlendedPerM !== null
        ? { labelKey: "highlight.blendedPrice", value: `$${model.priceBlendedPerM.toFixed(2)}/1M` }
        : null
    case "speed":
      return model.outputTokensPerSecond !== null
        ? { labelKey: "highlight.outputSpeed", value: `${model.outputTokensPerSecond.toFixed(0)} tok/s` }
        : null
    case "release":
      return model.releaseDate ? { labelKey: "highlight.releaseDate", value: model.releaseDate } : null
    case "provider":
      return null
  }
}
