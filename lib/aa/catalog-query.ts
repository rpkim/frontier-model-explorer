import { createTranslator } from "@/lib/i18n/translate"
import {
  filterModels,
  isOpenWeight,
  parseCatalogFilters,
  providersInCatalog,
  VALID_PURPOSES,
  type CatalogFilters,
  type PurposeKey,
} from "./filter"
import { groupModels, type GroupByKey } from "./group-by"
import { DEFAULT_SORT, sortModels, VALID_SORTS, type SortKey } from "./sort"
import type { HubDetail, HubSnapshot, ModelNode, Snapshot } from "./types"

export const GROUP_BY_KEYS = ["provider", "intelligence", "price", "speed", "release"] as const

const PURPOSE_SET = new Set<string>(VALID_PURPOSES)
const SORT_SET = new Set<string>(VALID_SORTS)
const GROUP_BY_SET = new Set<string>(GROUP_BY_KEYS)

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const MAX_OFFSET = 100_000
const MAX_QUERY_LENGTH = 200
const MAX_COMPARE = 4

export class CatalogQueryError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "CatalogQueryError"
    this.code = code
  }
}

export interface PublicModel extends ModelNode {
  /** Heuristic, not a license. See `isOpenWeight`. */
  openWeight: boolean
  /** Present only when the caller asked for Hub enrichment. */
  hub?: HubDetail | null
}

export interface ModelListQuery {
  q: string
  filters: CatalogFilters
  sort: SortKey
  limit: number
  offset: number
  includeHub: boolean
}

export interface ModelListResult {
  syncedAt: string
  total: number
  limit: number
  offset: number
  sort: SortKey
  filters: {
    q: string
    providers: string[]
    open: CatalogFilters["open"]
    purposes: PurposeKey[]
    includeHub: boolean
  }
  models: PublicModel[]
}

export function parseModelListQuery(
  params: URLSearchParams,
  bounds?: { defaultLimit?: number; maxLimit?: number },
): ModelListQuery {
  const defaultLimit = bounds?.defaultLimit ?? DEFAULT_LIMIT
  const maxLimit = bounds?.maxLimit ?? MAX_LIMIT
  const q = params.get("q")?.trim() ?? ""
  if (q.length > MAX_QUERY_LENGTH) {
    throw new CatalogQueryError("INVALID_QUERY", `q must be at most ${MAX_QUERY_LENGTH} characters.`)
  }

  const rawPurpose = params.get("purpose")
  if (rawPurpose) {
    const unknown = splitCsv(rawPurpose).filter((part) => !PURPOSE_SET.has(part))
    if (unknown.length > 0) {
      throw new CatalogQueryError("INVALID_PURPOSE", `Unknown purpose: ${unknown.join(", ")}.`)
    }
  }

  const rawSort = params.get("sort")
  if (rawSort && !SORT_SET.has(rawSort)) {
    throw new CatalogQueryError("INVALID_SORT", `Unknown sort: ${rawSort}.`)
  }

  const includeRaw = params.get("include")
  let includeHub = false
  if (includeRaw) {
    const parts = splitCsv(includeRaw)
    const unknown = parts.filter((part) => part !== "hub")
    if (unknown.length > 0) {
      throw new CatalogQueryError("INVALID_INCLUDE", `Unknown include: ${unknown.join(", ")}.`)
    }
    includeHub = parts.includes("hub")
  }

  const filters = parseCatalogFilters((key) => params.get(key))
  const singleProvider = params.get("provider")?.trim()
  if (singleProvider) {
    filters.providers = Array.from(new Set([...filters.providers, singleProvider]))
  }
  if (filters.providers.length > 40) {
    throw new CatalogQueryError("INVALID_PROVIDERS", "At most 40 provider slugs are allowed.")
  }

  return {
    q,
    filters,
    sort: (rawSort as SortKey | null) || DEFAULT_SORT,
    limit: parseBoundedInt(params.get("limit"), {
      code: "INVALID_LIMIT",
      fallback: defaultLimit,
      min: 1,
      max: maxLimit,
    }),
    offset: parseBoundedInt(params.get("offset"), {
      code: "INVALID_OFFSET",
      fallback: 0,
      min: 0,
      max: MAX_OFFSET,
    }),
    includeHub,
  }
}

export function parseGroupBy(raw: string | null): GroupByKey {
  if (!raw) return "provider"
  if (!GROUP_BY_SET.has(raw)) {
    throw new CatalogQueryError("INVALID_GROUP_BY", `Unknown by: ${raw}.`)
  }
  return raw as GroupByKey
}

export function parseCompareIds(params: URLSearchParams): string[] {
  const fromCsv = splitCsv(params.get("models"))
  const repeated = params.getAll("model").flatMap((value) => splitCsv(value))
  return uniquePreserve(fromCsv.concat(repeated))
}

export function assertCompareIds(ids: string[]): string[] {
  const unique = uniquePreserve(ids.map((id) => id.trim()).filter(Boolean))
  if (unique.length === 0) {
    throw new CatalogQueryError("INVALID_COMPARE", "Provide 1 to 4 model ids in models.")
  }
  if (unique.length > MAX_COMPARE) {
    throw new CatalogQueryError("TOO_MANY_MODELS", `Compare accepts at most ${MAX_COMPARE} models.`)
  }
  return unique
}

export function queryModels(snapshot: Snapshot, hub: HubSnapshot | null, query: ModelListQuery): ModelListResult {
  const matched = sortModels(applyTextQuery(filterModels(snapshot.models, query.filters), query.q), query.sort)
  return {
    syncedAt: snapshot.syncedAt,
    total: matched.length,
    limit: query.limit,
    offset: query.offset,
    sort: query.sort,
    filters: {
      q: query.q,
      providers: query.filters.providers,
      open: query.filters.open,
      purposes: query.filters.purposes,
      includeHub: query.includeHub,
    },
    models: matched.slice(query.offset, query.offset + query.limit).map((model) => toPublic(model, hub, query.includeHub)),
  }
}

export function getPublicModel(snapshot: Snapshot, hub: HubSnapshot | null, idOrSlug: string): PublicModel | null {
  const model = findModel(snapshot.models, idOrSlug)
  if (!model) return null
  return toPublic(model, hub, true)
}

export function comparePublicModels(snapshot: Snapshot, hub: HubSnapshot | null, ids: string[]) {
  const unique = assertCompareIds(ids)
  const models: PublicModel[] = []
  const missing: string[] = []
  for (const id of unique) {
    const model = findModel(snapshot.models, id)
    if (!model) missing.push(id)
    else models.push(toPublic(model, hub, true))
  }
  return { syncedAt: snapshot.syncedAt, models, missing }
}

export function listPublicProviders(snapshot: Snapshot) {
  const openCount = new Map<string, number>()
  for (const model of snapshot.models) {
    if (!isOpenWeight(model)) continue
    openCount.set(model.provider.slug, (openCount.get(model.provider.slug) ?? 0) + 1)
  }
  return {
    syncedAt: snapshot.syncedAt,
    providers: providersInCatalog(snapshot.models).map((facet) => ({
      id: facet.provider.id,
      name: facet.provider.name,
      slug: facet.provider.slug,
      count: facet.count,
      openCount: openCount.get(facet.provider.slug) ?? 0,
    })),
  }
}

/** Validates group-list query params without reading models. */
export function assertGroupQuery(params: URLSearchParams): void {
  parseModelListQuery(params, { defaultLimit: 1, maxLimit: MAX_LIMIT })
  parseGroupBy(params.get("by"))
}

export function listPublicGroups(snapshot: Snapshot, params: URLSearchParams) {
  const listQuery = parseModelListQuery(params, { defaultLimit: 1, maxLimit: MAX_LIMIT })
  const by = parseGroupBy(params.get("by"))
  const matched = sortModels(applyTextQuery(filterModels(snapshot.models, listQuery.filters), listQuery.q), listQuery.sort)
  const t = createTranslator("en")
  const groups = groupModels(by, matched).map((group) => ({
    id: group.id,
    label: group.labelKey ? t(group.labelKey) : group.label,
    count: group.models.length,
    modelIds: group.models.map((model) => model.id),
  }))
  return {
    syncedAt: snapshot.syncedAt,
    by,
    sort: listQuery.sort,
    filters: {
      q: listQuery.q,
      providers: listQuery.filters.providers,
      open: listQuery.filters.open,
      purposes: listQuery.filters.purposes,
    },
    groups,
  }
}

export function findModel(models: ModelNode[], idOrSlug: string): ModelNode | null {
  const key = idOrSlug.trim()
  if (!key) return null
  const byId = models.find((model) => model.id === key)
  if (byId) return byId
  const bySlug = models.filter((model) => model.slug === key)
  return bySlug.length === 1 ? bySlug[0] : null
}

function toPublic(model: ModelNode, hub: HubSnapshot | null, includeHub: boolean): PublicModel {
  const pub: PublicModel = { ...model, openWeight: isOpenWeight(model) }
  if (includeHub) pub.hub = hub?.models[model.id] ?? null
  return pub
}

function applyTextQuery(models: ModelNode[], q: string): ModelNode[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return models
  return models.filter((model) => {
    const hay = `${model.name} ${model.slug} ${model.id} ${model.provider.name} ${model.provider.slug}`.toLowerCase()
    return words.every((word) => hay.includes(word))
  })
}

function parseBoundedInt(
  raw: string | null,
  bounds: { code: string; fallback: number; min: number; max: number },
): number {
  if (raw == null || raw === "") return bounds.fallback
  if (!/^\d+$/.test(raw)) {
    throw new CatalogQueryError(bounds.code, "Expected a non-negative integer.")
  }
  const value = Number(raw)
  if (value < bounds.min || value > bounds.max) {
    throw new CatalogQueryError(bounds.code, `Value must be between ${bounds.min} and ${bounds.max}.`)
  }
  return value
}

function splitCsv(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

function uniquePreserve(values: string[]): string[] {
  return Array.from(new Set(values))
}
