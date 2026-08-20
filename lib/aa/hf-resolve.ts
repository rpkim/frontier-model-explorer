import { HF_IDS, officialUrlForHfId, type HfMapping } from "./hf-ids"
import type { ModelNode } from "./types"

export type ModelRef = Pick<ModelNode, "id" | "name" | "slug" | "provider">

export interface HfSearchHit {
  id?: string
  modelId?: string
  author?: string
  downloads?: number
  likes?: number
  pipeline_tag?: string
  tags?: string[]
  private?: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HF_ID_RE =
  /^(?:https?:\/\/huggingface\.co\/)?([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\/([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)$/
const SIZE_RE = /(?:^|-)(\d+(?:\.\d+)?[bmt]|a\d+b|e\d+b|\d+x\d+b|\d+e)(?:-|$)/i
const NOISE_RE =
  /(gguf|awq|gptq|exl2|bnb[-_]?[48]bit|nf4|imatrix|abliterated|uncensored|finetune|fine-tune|qlora|q[2-8]_k|speculative)/i

const ORG_PREFIXES = [
  "meta-llama",
  "huggingfacetb",
  "huggingfaceh4",
  "huggingface",
  "deepseek-ai",
  "ibm-granite",
  "moonshot-ai",
  "moonshotai",
  "minimaxai",
  "mistral-ai",
  "mistralai",
  "cohereforai",
  "coherelabs",
  "lgai-exaone",
  "liquidai",
  "zai-org",
  "01-ai",
  "allen-ai",
  "allenai",
  "tiiuae",
  "swiss-ai",
  "facebook",
  "meta",
  "google",
  "qwen",
  "alibaba",
  "deepseek",
  "mistral",
  "microsoft",
  "openai",
  "moonshot",
  "thudm",
  "zhipu",
  "ibm",
  "nvidia",
  "minimax",
  "databricks",
  "tii",
  "internlm",
  "upstage",
].sort((a, b) => b.length - a.length)

const EFFORT_SUFFIXES = [
  "-reasoning-max-effort",
  "-max-effort",
  "-non-reasoning",
  "-xhigh",
  "-extra-high",
  "-high",
  "-medium",
  "-low",
]

const INSTRUCT_SUFFIXES = ["-instruct", "-chat", "-it", "-hf"]

const OPTIONAL_TOKENS = new Set([
  "instruct",
  "chat",
  "it",
  "hf",
  "base",
  "preview",
  "release",
  "v1",
  "v0",
  "latest",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "effort",
])

const DISTINCTIVE_VARIANT_TOKENS = new Set([
  "thinking",
  "reasoning",
  "coder",
  "vision",
  "vl",
  "next",
  "distill",
  "guard",
  "math",
])

interface OrgRule {
  slugs: string[]
  nameRe: RegExp
  familyRe: RegExp
  authors: string[]
}

const ORG_RULES: OrgRule[] = [
  { slugs: ["meta"], nameRe: /^(meta|facebook)/i, familyRe: /\bllama\b/i, authors: ["meta-llama"] },
  { slugs: ["alibaba", "qwen"], nameRe: /qwen|alibaba/i, familyRe: /\b(qwen|qwq)\b/i, authors: ["Qwen"] },
  { slugs: ["deepseek"], nameRe: /deepseek/i, familyRe: /\bdeepseek\b/i, authors: ["deepseek-ai"] },
  { slugs: ["mistral", "mistral-ai"], nameRe: /mistral/i, familyRe: /\b(mistral|mixtral|codestral|devstral|magistral|ministral)\b/i, authors: ["mistralai"] },
  { slugs: ["google"], nameRe: /google/i, familyRe: /\bgemma\b/i, authors: ["google"] },
  { slugs: ["microsoft"], nameRe: /microsoft/i, familyRe: /\bphi\b/i, authors: ["microsoft"] },
  { slugs: ["openai"], nameRe: /openai/i, familyRe: /\bgpt-oss\b/i, authors: ["openai"] },
  { slugs: ["moonshot", "moonshot-ai", "kimi"], nameRe: /moonshot|kimi/i, familyRe: /\bkimi\b/i, authors: ["moonshotai"] },
  { slugs: ["zhipu-ai", "zhipuai"], nameRe: /zhipu|^z ai$/i, familyRe: /\bglm\b/i, authors: ["zai-org", "THUDM"] },
  { slugs: ["01-ai", "01ai"], nameRe: /01\.?\s*ai/i, familyRe: /\byi\b/i, authors: ["01-ai"] },
  { slugs: ["allenai", "allen-ai", "ai2"], nameRe: /allen|ai2/i, familyRe: /\bolmo\b/i, authors: ["allenai"] },
  { slugs: ["ibm"], nameRe: /ibm/i, familyRe: /\bgranite\b/i, authors: ["ibm-granite"] },
  { slugs: ["nvidia"], nameRe: /nvidia/i, familyRe: /\bnemotron\b/i, authors: ["nvidia"] },
  { slugs: ["minimax"], nameRe: /minimax/i, familyRe: /\bminimax\b/i, authors: ["MiniMaxAI"] },
  { slugs: ["databricks"], nameRe: /databricks/i, familyRe: /\bdbrx\b/i, authors: ["databricks"] },
  { slugs: ["tii", "tiiuae"], nameRe: /tii/i, familyRe: /\bfalcon\b/i, authors: ["tiiuae"] },
  { slugs: ["huggingface", "hugging-face"], nameRe: /hugging\s?face/i, familyRe: /\bsmollm\b/i, authors: ["HuggingFaceTB", "HuggingFaceH4"] },
  { slugs: ["liquid", "liquid-ai"], nameRe: /liquid/i, familyRe: /\b(lfm|liquid)\b/i, authors: ["LiquidAI"] },
  { slugs: ["lg", "lg-ai"], nameRe: /lg ai/i, familyRe: /\bexaone\b/i, authors: ["LGAI-EXAONE"] },
  { slugs: ["upstage"], nameRe: /upstage/i, familyRe: /\bsolar\b/i, authors: ["upstage"] },
  { slugs: ["cohere"], nameRe: /cohere/i, familyRe: /\bcommand-?r\b/i, authors: ["CohereForAI", "CohereLabs"] },
  { slugs: ["internlm"], nameRe: /internlm/i, familyRe: /\binternlm\b/i, authors: ["internlm"] },
  { slugs: ["xiaomi"], nameRe: /xiaomi/i, familyRe: /\bmimo\b/i, authors: ["XiaomiMiMo"] },
  { slugs: ["meituan"], nameRe: /meituan|longcat/i, familyRe: /\blongcat\b/i, authors: ["meituan-longcat"] },
]

let mappingIndex: Map<string, HfMapping[]> | undefined

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

function stripOrgPrefixes(key: string): string[] {
  const out = [key]
  for (const prefix of ORG_PREFIXES) {
    if (key.startsWith(`${prefix}-`) && key.length > prefix.length + 2) {
      out.push(key.slice(prefix.length + 1))
    }
  }
  return uniqueStrings(out)
}

function stripEffort(key: string): string[] {
  const out = [key]
  let current = key
  for (const suffix of EFFORT_SUFFIXES) {
    if (current.endsWith(suffix) && current.length > suffix.length + 2) {
      current = current.slice(0, -suffix.length)
      out.push(current)
    }
  }
  return uniqueStrings(out)
}

function stripInstruct(key: string): string[] {
  const out = [key]
  for (const suffix of INSTRUCT_SUFFIXES) {
    if (key.endsWith(suffix) && key.length > suffix.length + 2) {
      out.push(key.slice(0, -suffix.length))
    }
  }
  return uniqueStrings(out)
}

function instructSizeVariants(key: string): string[] {
  const out = [key]
  const beforeSize = key.match(/^(.*)-instruct-(\d+(?:\.\d+)?[bmt](?:-[a-z0-9]+)?)$/i)
  if (beforeSize) out.push(`${beforeSize[1]}-${beforeSize[2]}-instruct`)
  const afterSize = key.match(/^(.*)-(\d+(?:\.\d+)?[bmt])-instruct$/i)
  if (afterSize) out.push(`${afterSize[1]}-instruct-${afterSize[2]}`)
  const chatBefore = key.match(/^(.*)-chat-(\d+(?:\.\d+)?[bmt](?:-[a-z0-9]+)?)$/i)
  if (chatBefore) out.push(`${chatBefore[1]}-${chatBefore[2]}-chat`)
  return uniqueStrings(out)
}

function keyVariants(raw: string): string[] {
  const normalized = normalizeKey(raw)
  const out: string[] = []
  for (const prefixed of stripOrgPrefixes(normalized)) {
    for (const effort of stripEffort(prefixed)) {
      for (const ordered of instructSizeVariants(effort)) {
        for (const instructed of stripInstruct(ordered)) {
          out.push(prefixed, effort, ordered, instructed)
        }
      }
    }
  }
  return uniqueStrings(out)
}

function extractHfId(value: string): string | undefined {
  const trimmed = value.trim()
  const match = HF_ID_RE.exec(trimmed)
  if (!match) return undefined
  return `${match[1]}/${match[2]}`
}

function getIndex(): Map<string, HfMapping[]> {
  if (mappingIndex) return mappingIndex
  const index = new Map<string, HfMapping[]>()
  const add = (key: string, mapping: HfMapping) => {
    const list = index.get(key)
    if (list) {
      if (!list.some((row) => row.hfId === mapping.hfId)) list.push(mapping)
    } else {
      index.set(key, [mapping])
    }
  }

  for (const [slug, mapping] of Object.entries(HF_IDS)) {
    for (const variant of keyVariants(slug)) add(variant, mapping)
    const repo = mapping.hfId.split("/")[1]
    if (repo) {
      for (const variant of keyVariants(repo)) add(variant, mapping)
    }
    for (const variant of keyVariants(mapping.hfId)) add(variant, mapping)
  }

  mappingIndex = index
  return index
}

function uniqueMapping(hits: HfMapping[] | undefined): HfMapping | undefined {
  if (!hits || hits.length === 0) return undefined
  const seen = new Set<string>()
  const unique: HfMapping[] = []
  for (const hit of hits) {
    if (seen.has(hit.hfId)) continue
    seen.add(hit.hfId)
    unique.push(hit)
  }
  return unique.length === 1 ? unique[0] : undefined
}

function lookupKeys(model: ModelRef): string[] {
  const raw = [model.slug, model.name]
  if (model.id && !UUID_RE.test(model.id)) raw.push(model.id)
  const keys: string[] = []
  const seen = new Set<string>()
  const add = (value: string) => {
    if (!value || seen.has(value)) return
    seen.add(value)
    keys.push(value)
  }

  for (const value of raw) {
    add(value)
    add(value.toLowerCase())
    const hfId = extractHfId(value)
    if (hfId) {
      add(hfId)
      add(hfId.toLowerCase())
      add(hfId.split("/")[1] ?? "")
    }
    for (const variant of keyVariants(value)) add(variant)
  }

  return keys
}

function mappingFromExact(model: ModelRef): HfMapping | undefined {
  return (
    HF_IDS[model.slug] ??
    HF_IDS[model.slug.toLowerCase()] ??
    (UUID_RE.test(model.id) ? undefined : HF_IDS[model.id]) ??
    HF_IDS[normalizeKey(model.slug)] ??
    HF_IDS[normalizeKey(model.name)]
  )
}

/**
 * Layer 1–2: curated map, then normalized aliases (case, `.`/`-`/`_`, org prefixes,
 * instruct/size order, trailing `-it`/`-instruct`, AA reasoning-effort suffixes).
 */
export function resolveHfMapping(model: ModelRef): HfMapping | undefined {
  const exact = mappingFromExact(model)
  if (exact) return exact

  const embedded = extractHfId(model.slug) ?? extractHfId(model.name)
  if (embedded) {
    const mapped = HF_IDS[normalizeKey(embedded)] ?? HF_IDS[normalizeKey(embedded.split("/")[1] ?? "")]
    if (mapped) return mapped
    return { hfId: embedded, officialUrl: officialUrlForHfId(embedded) }
  }

  const index = getIndex()
  for (const key of lookupKeys(model)) {
    const mapped = uniqueMapping(index.get(key))
    if (mapped) return mapped
  }
  return undefined
}

function haystack(model: ModelRef): string {
  return `${model.slug} ${model.name} ${model.provider.slug} ${model.provider.name}`
}

export function expectedHfAuthors(model: ModelRef): string[] {
  const authors: string[] = []
  const slug = model.provider.slug.toLowerCase()
  const providerName = model.provider.name
  const text = haystack(model)

  for (const rule of ORG_RULES) {
    const slugHit = rule.slugs.includes(slug)
    const nameHit = rule.nameRe.test(providerName)
    const familyHit = rule.familyRe.test(text)
    if (slugHit || nameHit || familyHit) authors.push(...rule.authors)
  }

  return uniqueStrings(authors)
}

function cleanedDisplayName(model: ModelRef): string {
  return model.name
    .replace(/\s*\((?:low|medium|high|xhigh|max|reasoning|non-reasoning)\)\s*/gi, " ")
    .replace(/\s*\(([^)]+)\)/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
}

function hyphenatePreserveCase(name: string): string {
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .join("-")
}

function reorderInstructAfterSize(repo: string): string {
  return repo.replace(/-(Instruct|Chat|IT)-(\d+(?:\.\d+)?[BMT](?:-[A-Za-z0-9]+)?)$/i, "-$2-$1")
}

function hasSizeToken(key: string): boolean {
  return SIZE_RE.test(key)
}

function plausibleRepoName(name: string): boolean {
  const key = normalizeKey(name)
  if (key.length < 4) return false
  if (hasSizeToken(key)) return true
  if (/(?:^|-)(v\d|k\d|r\d|m\d|oss)(?:-|$)/i.test(key)) return true
  return key.split("-").length >= 2
}

function gemmaRepo(name: string): string {
  const key = normalizeKey(name).replace(/-instruct$/, "")
  if (key.endsWith("-it") || key.endsWith("-pt")) return key
  return `${key}-it`
}

function preferInstructRepo(repo: string, author: string, name: string): string[] {
  const key = normalizeKey(repo)
  if (INSTRUCT_SUFFIXES.some((suffix) => key.endsWith(suffix))) return [repo]
  if (author.toLowerCase() === "google" || author.toLowerCase() === "openai") return [repo]
  if (/\bbase\b/i.test(name)) return [repo]
  return [`${repo}-Instruct`, repo]
}

function candidateRepoNames(model: ModelRef, author: string): string[] {
  const cleaned = cleanedDisplayName(model)
  const authorLower = author.toLowerCase()
  if (authorLower === "google") return uniqueStrings([gemmaRepo(cleaned), gemmaRepo(model.slug)])
  if (authorLower === "openai" || authorLower === "ibm-granite") {
    return uniqueStrings([
      stripEffort(normalizeKey(cleaned)).at(-1) ?? normalizeKey(cleaned),
      stripEffort(normalizeKey(model.slug)).at(-1) ?? normalizeKey(model.slug),
    ]).filter(plausibleRepoName)
  }

  const titled = hyphenatePreserveCase(cleaned)
  const reordered = reorderInstructAfterSize(titled)
  return uniqueStrings([
    ...preferInstructRepo(reordered, author, cleaned),
    reordered,
    titled,
  ]).filter(plausibleRepoName)
}

export function guessHfMappings(model: ModelRef): HfMapping[] {
  const authors = expectedHfAuthors(model)
  if (authors.length === 0) return []
  const author = authors[0]
  const seen = new Set<string>()
  const mappings: HfMapping[] = []
  for (const repo of candidateRepoNames(model, author).slice(0, 2)) {
    const hfId = `${author}/${repo}`
    if (seen.has(hfId.toLowerCase())) continue
    seen.add(hfId.toLowerCase())
    mappings.push({ hfId, officialUrl: officialUrlForHfId(hfId) })
  }
  return mappings
}

/**
 * Layer 3: provider-aware repo templates. High-confidence only — Hub fetch
 * still verifies the id, and a 404 falls through to search.
 */
export function guessHfMapping(model: ModelRef): HfMapping | undefined {
  return guessHfMappings(model)[0]
}

export function hfSearchQuery(model: ModelRef): string {
  const cleaned = cleanedDisplayName(model).replace(/[()]/g, " ").replace(/\s+/g, " ").trim()
  if (cleaned.length >= 3) return cleaned
  const slug = stripEffort(normalizeKey(model.slug)).at(-1) ?? model.slug
  return slug.replace(/-/g, " ")
}

function tokensOf(value: string): string[] {
  const raw = normalizeKey(value).split("-").filter(Boolean)
  const out: string[] = []
  for (const token of raw) {
    const split = token.match(/^([a-z]+)(\d.*)$/i)
    if (split && !/^\d/.test(token)) {
      out.push(split[1], split[2])
    } else {
      out.push(token)
    }
  }
  return out
}

function sizeToken(value: string): string | undefined {
  const match = normalizeKey(value).match(SIZE_RE)
  return match?.[1]?.toLowerCase()
}

function authorOf(hit: HfSearchHit): string | undefined {
  if (typeof hit.author === "string" && hit.author) return hit.author
  const id = hit.id ?? hit.modelId
  return id?.split("/")[0]
}

function repoOf(hit: HfSearchHit): string | undefined {
  const id = hit.id ?? hit.modelId
  return id?.split("/")[1]
}

function authorsMatch(expected: string[], author: string): boolean {
  const lower = author.toLowerCase()
  return expected.some((org) => org.toLowerCase() === lower)
}

function coreRepoName(repo: string): string {
  let key = normalizeKey(repo)
  for (const suffix of [...EFFORT_SUFFIXES, ...INSTRUCT_SUFFIXES, "-base"]) {
    if (key.endsWith(suffix) && key.length > suffix.length + 2) {
      key = key.slice(0, -suffix.length)
    }
  }
  return key
}

function variantMismatchPenalty(repo: string, model: ModelRef): number {
  const repoTokens = new Set(tokensOf(repo))
  const modelTokens = new Set(tokensOf(`${model.slug} ${cleanedDisplayName(model)}`))
  let penalty = 0
  for (const token of DISTINCTIVE_VARIANT_TOKENS) {
    const inRepo = repoTokens.has(token)
    const inModel = modelTokens.has(token)
    if (inRepo !== inModel) penalty += token === "thinking" || token === "coder" || token === "vision" ? 25 : 12
  }
  const repoInstruct = repoTokens.has("instruct") || repoTokens.has("chat") || repoTokens.has("it")
  const modelInstruct = modelTokens.has("instruct") || modelTokens.has("chat") || modelTokens.has("it")
  if (repoInstruct !== modelInstruct) penalty += 4
  return penalty
}

function requiredTokens(model: ModelRef): string[] {
  const slug = stripEffort(normalizeKey(model.slug)).at(-1) ?? model.slug
  return tokensOf(`${slug} ${cleanedDisplayName(model)}`).filter((token) => !OPTIONAL_TOKENS.has(token))
}

function scoreHit(model: ModelRef, hit: HfSearchHit, expected: string[]): number | null {
  const id = hit.id ?? hit.modelId
  const author = authorOf(hit)
  const repo = repoOf(hit)
  if (!id || !author || !repo || hit.private) return null
  if (NOISE_RE.test(repo) && (expected.length === 0 || !authorsMatch(expected, author))) return null

  if (expected.length > 0 && !authorsMatch(expected, author)) return null

  const modelSize = sizeToken(`${model.slug} ${model.name}`)
  const repoSize = sizeToken(repo)
  if (modelSize && repoSize && modelSize !== repoSize) return null

  const repoTokens = new Set(tokensOf(repo))
  const missing = requiredTokens(model).filter((token) => {
    if (token.length === 1) return false
    return !repoTokens.has(token)
  })
  // Allow a couple of missing generic tokens, but family + size must be present.
  if (missing.length > 2) return null
  const missingDistinctive = missing.filter((token) => DISTINCTIVE_VARIANT_TOKENS.has(token) || SIZE_RE.test(`-${token}-`))
  if (missingDistinctive.length > 0) return null

  let score = 40
  if (authorsMatch(expected, author)) score += 40
  if (NOISE_RE.test(repo)) score -= 28
  score -= variantMismatchPenalty(repo, model)
  const overlap = requiredTokens(model).filter((token) => repoTokens.has(token)).length
  score += Math.min(20, overlap * 3)
  score += Math.log10((hit.downloads ?? 0) + 1)
  if ((hit.likes ?? 0) > 50) score += 2
  return score
}

/**
 * Pick a Hub search hit only when the owner and tokens make a confident match.
 * Ambiguous official forks stay unmapped rather than guessing a fine-tune.
 */
export function pickHfSearchHit(model: ModelRef, hits: HfSearchHit[]): HfMapping | undefined {
  const expected = expectedHfAuthors(model)
  const scored = hits
    .map((hit) => ({ hit, score: scoreHit(model, hit, expected) }))
    .filter((row): row is { hit: HfSearchHit; score: number } => row.score != null)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return undefined

  const best = scored[0]
  const minScore = expected.length > 0 ? 55 : 75
  if (best.score < minScore) return undefined

  const second = scored[1]
  if (second && second.score > best.score - 6) {
    const bestRepo = repoOf(best.hit)
    const secondRepo = repoOf(second.hit)
    if (bestRepo && secondRepo && coreRepoName(bestRepo) !== coreRepoName(secondRepo)) {
      return undefined
    }
  }

  const hfId = best.hit.id ?? best.hit.modelId
  if (!hfId) return undefined
  return { hfId, officialUrl: officialUrlForHfId(hfId) }
}

export function mappingFromHubCache(
  existing: { hfId?: string; officialUrl?: string; error?: string; serving?: { ollama?: string } } | undefined,
): HfMapping | undefined {
  if (!existing?.hfId) return undefined
  if (existing.error === "unmapped" || existing.error === "not_found") return undefined
  const ollamaUrl = existing.serving?.ollama
  const ollama = ollamaUrl?.startsWith("https://ollama.com/library/")
    ? ollamaUrl.slice("https://ollama.com/library/".length)
    : undefined
  return {
    hfId: existing.hfId,
    officialUrl: existing.officialUrl,
    ...(ollama ? { ollama } : {}),
  }
}
