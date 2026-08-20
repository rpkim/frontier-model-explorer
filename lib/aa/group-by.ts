import type { ModelNode } from "./types"

export type GroupByKey = "provider" | "intelligence" | "price" | "speed" | "release"

export const GROUP_BY_OPTIONS: { key: GroupByKey; label: string; description: string }[] = [
  { key: "provider", label: "제공사", description: "모델을 만든 회사 기준" },
  { key: "intelligence", label: "성능", description: "Intelligence Index 점수대 기준" },
  { key: "price", label: "가격", description: "1M 토큰당 비용 기준" },
  { key: "speed", label: "속도", description: "초당 처리 토큰 수 기준" },
  { key: "release", label: "출시일", description: "출시 시점 기준" },
]

export interface Group {
  /** Stable identifier used in the URL and as a React key */
  id: string
  /** Short label shown on the node */
  label: string
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
  order: number
  test: (m: ModelNode) => boolean
}

function bucketGroups(models: ModelNode[], buckets: Bucket[]): Group[] {
  const groups: Group[] = buckets.map((b) => ({
    id: b.id,
    label: b.label,
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
  const tiers: [number, string][] = [
    [60, "60+ · 최상위권"],
    [50, "50–59"],
    [40, "40–49"],
    [30, "30–39"],
    [20, "20–29"],
    [10, "10–19"],
    [0, "0–9"],
  ]
  const buckets: Bucket[] = tiers.map(([min, label], i) => ({
    id: `intel-${min}`,
    label,
    order: i,
    test: (m) => m.intelligenceIndex !== null && m.intelligenceIndex >= min,
  }))
  buckets.push({
    id: "intel-unknown",
    label: "점수 없음",
    order: UNKNOWN_ORDER,
    test: () => true,
  })
  return bucketGroups(models, buckets).map((g) => ({
    ...g,
    models: g.models.sort((a, b) => (b.intelligenceIndex ?? -1) - (a.intelligenceIndex ?? -1)),
  }))
}

export function groupByPrice(models: ModelNode[]): Group[] {
  const tiers: [number, string][] = [
    [0, "$0.5 미만 · 초저가"],
    [0.5, "$0.5 – $2"],
    [2, "$2 – $5"],
    [5, "$5 – $15"],
    [15, "$15 – $50"],
    [50, "$50 이상 · 최고가"],
  ]
  const buckets: Bucket[] = tiers
    .map(([min, label], i) => ({
      id: `price-${min}`,
      label,
      order: i,
      test: (m: ModelNode) => m.priceBlendedPerM !== null && m.priceBlendedPerM >= min,
    }))
    .reverse() // check highest threshold first
  buckets.push({
    id: "price-unknown",
    label: "가격 정보 없음",
    order: UNKNOWN_ORDER,
    test: () => true,
  })
  return bucketGroups(models, buckets).map((g) => ({
    ...g,
    models: g.models.sort((a, b) => (a.priceBlendedPerM ?? Infinity) - (b.priceBlendedPerM ?? Infinity)),
  }))
}

export function groupBySpeed(models: ModelNode[]): Group[] {
  const tiers: [number, string][] = [
    [600, "600+ tok/s · 초고속"],
    [300, "300–599 tok/s"],
    [150, "150–299 tok/s"],
    [75, "75–149 tok/s"],
    [0, "75 tok/s 미만"],
  ]
  const buckets: Bucket[] = tiers.map(([min, label], i) => ({
    id: `speed-${min}`,
    label,
    order: i,
    test: (m) => m.outputTokensPerSecond !== null && m.outputTokensPerSecond >= min,
  }))
  buckets.push({
    id: "speed-unknown",
    label: "속도 정보 없음",
    order: UNKNOWN_ORDER,
    test: () => true,
  })
  return bucketGroups(models, buckets).map((g) => ({
    ...g,
    models: g.models.sort((a, b) => (b.outputTokensPerSecond ?? -1) - (a.outputTokensPerSecond ?? -1)),
  }))
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
    models: entry.models.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")),
    order: -entry.sortKey, // most recent first
  }))
  if (unknown.length > 0) {
    groups.push({ id: "release-unknown", label: "출시일 미정", models: unknown, order: UNKNOWN_ORDER })
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
export function highlightMetricFor(by: GroupByKey, model: ModelNode): { label: string; value: string } | null {
  switch (by) {
    case "intelligence":
      return model.intelligenceIndex !== null
        ? { label: "Intelligence Index", value: model.intelligenceIndex.toFixed(1) }
        : null
    case "price":
      return model.priceBlendedPerM !== null
        ? { label: "블렌디드 가격", value: `$${model.priceBlendedPerM.toFixed(2)}/1M` }
        : null
    case "speed":
      return model.outputTokensPerSecond !== null
        ? { label: "출력 속도", value: `${model.outputTokensPerSecond.toFixed(0)} tok/s` }
        : null
    case "release":
      return model.releaseDate ? { label: "출시일", value: model.releaseDate } : null
    case "provider":
      return null
  }
}
