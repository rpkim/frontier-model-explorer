import type { ModelNode, Provider } from "./types"
import type { MessageKey } from "@/lib/i18n/translate"

/** Shareable catalog filters. URL params: `providers`, `open`, `purpose`. */

export type OpenFilter = "all" | "open" | "proprietary"

export type PurposeKey = "coding" | "reasoning" | "math" | "cheap" | "fast"

export interface CatalogFilters {
  /** Provider slugs to include. Empty means every provider. */
  providers: string[]
  open: OpenFilter
  purposes: PurposeKey[]
}

export const EMPTY_FILTERS: CatalogFilters = {
  providers: [],
  open: "all",
  purposes: [],
}

export const PURPOSE_OPTIONS: { key: PurposeKey; labelKey: MessageKey }[] = [
  { key: "coding", labelKey: "filter.coding" },
  { key: "reasoning", labelKey: "filter.reasoning" },
  { key: "math", labelKey: "filter.math" },
  { key: "cheap", labelKey: "filter.cheap" },
  { key: "fast", labelKey: "filter.fast" },
]

export const VALID_PURPOSES: PurposeKey[] = PURPOSE_OPTIONS.map((opt) => opt.key)

/**
 * Purpose presets use absolute metric cutoffs (aligned with mind-map buckets)
 * so a shared URL means the same thing after a resync — not a moving percentile.
 * Models missing the relevant metric are excluded from that purpose.
 */
const CODING_MIN_INDEX = 40
const REASONING_MIN_INDEX = 40
const MATH_MIN_INDEX = 70
const CHEAP_MAX_BLENDED = 2
const FAST_MIN_TOKENS_PER_SEC = 150

const VALID_PURPOSE_SET = new Set<string>(VALID_PURPOSES)

/**
 * The `/api/v2/data/llms/models` catalog we ingest has no license / open-weights
 * field (those exist on the Pro language-model API). `isOpenWeight` is a
 * best-effort heuristic: known open-weight creators, plus common open-family
 * name patterns. Closed labs (OpenAI, Anthropic, Google Gemini, xAI, …) stay
 * proprietary unless the model name matches an open family such as Gemma or gpt-oss.
 */
const OPEN_CREATOR_SLUGS = new Set([
  "meta",
  "mistral",
  "mistral-ai",
  "deepseek",
  "alibaba",
  "qwen",
  "01-ai",
  "01ai",
  "zhipu-ai",
  "zhipuai",
  "ibm",
  "databricks",
  "nvidia",
  "allenai",
  "allen-ai",
  "ai2",
  "huggingface",
  "hugging-face",
  "eleutherai",
  "tii",
  "tiiuae",
  "liquid",
  "liquid-ai",
  "snowflake",
  "together",
  "together-ai",
  "microsoft",
  "moonshot",
  "moonshot-ai",
  "minimax",
  "lg",
  "lg-ai",
  "upstage",
  "baichuan",
  "internlm",
  "xiaomi",
  "meituan",
  "nous-research",
  "nous",
  "essential-ai",
  "swiss-ai",
  "stability",
  "stability-ai",
  "bigscience",
  "rwkv",
])

const CLOSED_CREATOR_SLUGS = new Set([
  "openai",
  "anthropic",
  "google",
  "xai",
  "amazon",
  "amazon-nova",
  "cohere",
  "perplexity",
  "ai21",
  "writer",
  "reka",
  "inflection",
  "character-ai",
])

const OPEN_CREATOR_NAME_RE =
  /^(meta|facebook|mistral|deepseek|alibaba|qwen|01\.?\s*ai|zhipu|ibm|databricks|nvidia|allenai|allen ai|hugging ?face|eleuther|tii|liquid|snowflake|together|moonshot|minimax|microsoft|lg ai|upstage|baichuan|internlm|xiaomi|meituan|nous|essential ai|swiss ai|stability|bigscience)/i

const OPEN_FAMILY_RE =
  /\b(llama|gemma|mistral|mixtral|qwen|deepseek|phi-?\d|\bphi\b|olmo|nemotron|granite|dbrx|yi-?\d|falcon|glm-?\d|internlm|kimi|gpt-oss|openai-oss|command[\s-]?r|jamba|exaone|apertus|hunyuan|baichuan|smollm|stablelm|zephyr|openchat|wizardlm|vicuna|bloom|rwkv|seed-oss)\b/i

export function isOpenWeight(model: ModelNode): boolean {
  const slug = model.provider.slug.toLowerCase()
  const creatorName = model.provider.name.trim()

  if (OPEN_FAMILY_RE.test(model.name)) return true
  if (CLOSED_CREATOR_SLUGS.has(slug)) return false
  if (OPEN_CREATOR_SLUGS.has(slug) || OPEN_CREATOR_NAME_RE.test(creatorName)) return true
  return false
}

export function parseCatalogFilters(get: (key: string) => string | null): CatalogFilters {
  const providers = parseCsv(get("providers"))
  const purposes = parseCsv(get("purpose")).filter((key): key is PurposeKey => VALID_PURPOSE_SET.has(key))
  return {
    providers,
    open: parseOpenFilter(get("open")),
    purposes,
  }
}

export function serializeCatalogFilters(filters: CatalogFilters): Record<string, string | null> {
  return {
    providers: uniqueSorted(filters.providers).join(",") || null,
    open: filters.open === "open" ? "1" : filters.open === "proprietary" ? "0" : null,
    purpose: uniqueSorted(filters.purposes).join(",") || null,
  }
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return activeFilterCount(filters) > 0
}

export function activeFilterCount(filters: CatalogFilters): number {
  return filters.providers.length + (filters.open === "all" ? 0 : 1) + filters.purposes.length
}

export function filterModels(models: ModelNode[], filters: CatalogFilters): ModelNode[] {
  if (!hasActiveFilters(filters)) return models

  const providerSet = filters.providers.length > 0 ? new Set(filters.providers) : null

  return models.filter((model) => {
    if (providerSet && !providerSet.has(model.provider.slug)) return false
    if (filters.open === "open" && !isOpenWeight(model)) return false
    if (filters.open === "proprietary" && isOpenWeight(model)) return false
    for (const purpose of filters.purposes) {
      if (!matchesPurpose(model, purpose)) return false
    }
    return true
  })
}

export interface ProviderFacet {
  provider: Provider
  count: number
}

export function providersInCatalog(models: ModelNode[]): ProviderFacet[] {
  const map = new Map<string, ProviderFacet>()
  for (const model of models) {
    const existing = map.get(model.provider.slug)
    if (existing) {
      existing.count += 1
    } else {
      map.set(model.provider.slug, { provider: model.provider, count: 1 })
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.provider.name.localeCompare(b.provider.name),
  )
}

function matchesPurpose(model: ModelNode, purpose: PurposeKey): boolean {
  switch (purpose) {
    case "coding":
      if (model.codingIndex !== null) return model.codingIndex >= CODING_MIN_INDEX
      return (
        model.benchmarks.livecodebench != null ||
        model.benchmarks.scicode != null ||
        model.benchmarks.terminalbench_hard != null ||
        model.benchmarks.terminalbench_v2_1 != null
      )
    case "reasoning":
      return model.intelligenceIndex !== null && model.intelligenceIndex >= REASONING_MIN_INDEX
    case "math":
      return model.mathIndex !== null && model.mathIndex >= MATH_MIN_INDEX
    case "cheap":
      return model.priceBlendedPerM !== null && model.priceBlendedPerM < CHEAP_MAX_BLENDED
    case "fast":
      return model.outputTokensPerSecond !== null && model.outputTokensPerSecond >= FAST_MIN_TOKENS_PER_SEC
  }
}

function parseOpenFilter(raw: string | null): OpenFilter {
  if (raw === "1" || raw === "true" || raw === "open") return "open"
  if (raw === "0" || raw === "false" || raw === "proprietary" || raw === "closed") return "proprietary"
  return "all"
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return []
  return uniqueSorted(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
