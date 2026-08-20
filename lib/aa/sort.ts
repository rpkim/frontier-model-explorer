import type { Group } from "./group-by"
import type { ModelNode } from "./types"
import type { MessageKey } from "@/lib/i18n/translate"

export type SortKey =
  | "intelligence-desc"
  | "intelligence-asc"
  | "release-desc"
  | "release-asc"
  | "price-asc"
  | "price-desc"
  | "speed-desc"
  | "speed-asc"
  | "name-asc"

export const DEFAULT_SORT: SortKey = "intelligence-desc"

export const SORT_OPTIONS: { key: SortKey; labelKey: MessageKey }[] = [
  { key: "intelligence-desc", labelKey: "sort.intelligenceDesc" },
  { key: "intelligence-asc", labelKey: "sort.intelligenceAsc" },
  { key: "release-desc", labelKey: "sort.releaseDesc" },
  { key: "release-asc", labelKey: "sort.releaseAsc" },
  { key: "price-asc", labelKey: "sort.priceAsc" },
  { key: "price-desc", labelKey: "sort.priceDesc" },
  { key: "speed-desc", labelKey: "sort.speedDesc" },
  { key: "speed-asc", labelKey: "sort.speedAsc" },
  { key: "name-asc", labelKey: "sort.nameAsc" },
]

export const VALID_SORTS: SortKey[] = SORT_OPTIONS.map((opt) => opt.key)

function nullsLast(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === "desc" ? b - a : a - b
}

function compareRelease(a: string | null, b: string | null, dir: "asc" | "desc"): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const cmp = a.localeCompare(b)
  return dir === "desc" ? -cmp : cmp
}

export function compareModels(a: ModelNode, b: ModelNode, sort: SortKey): number {
  switch (sort) {
    case "intelligence-desc":
      return nullsLast(a.intelligenceIndex, b.intelligenceIndex, "desc")
    case "intelligence-asc":
      return nullsLast(a.intelligenceIndex, b.intelligenceIndex, "asc")
    case "release-desc":
      return compareRelease(a.releaseDate, b.releaseDate, "desc")
    case "release-asc":
      return compareRelease(a.releaseDate, b.releaseDate, "asc")
    case "price-asc":
      return nullsLast(a.priceBlendedPerM, b.priceBlendedPerM, "asc")
    case "price-desc":
      return nullsLast(a.priceBlendedPerM, b.priceBlendedPerM, "desc")
    case "speed-desc":
      return nullsLast(a.outputTokensPerSecond, b.outputTokensPerSecond, "desc")
    case "speed-asc":
      return nullsLast(a.outputTokensPerSecond, b.outputTokensPerSecond, "asc")
    case "name-asc":
      return a.name.localeCompare(b.name)
  }
}

export function sortModels(models: ModelNode[], sort: SortKey): ModelNode[] {
  return [...models].sort((a, b) => compareModels(a, b, sort) || a.name.localeCompare(b.name))
}

/** Reorder provider groups by the already-sorted first model in each group. */
export function sortGroupsByTopModel(groups: Group[], sort: SortKey): Group[] {
  return [...groups].sort((a, b) => {
    const ma = a.models[0]
    const mb = b.models[0]
    if (!ma && !mb) return 0
    if (!ma) return 1
    if (!mb) return -1
    return compareModels(ma, mb, sort) || a.label.localeCompare(b.label)
  })
}
