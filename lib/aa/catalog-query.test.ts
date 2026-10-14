import assert from "node:assert/strict"
import {
  CatalogQueryError,
  comparePublicModels,
  getPublicModel,
  listPublicGroups,
  listPublicProviders,
  parseModelListQuery,
  queryModels,
} from "./catalog-query"
import type { ModelNode, Snapshot } from "./types"

function model(overrides: Partial<ModelNode> & Pick<ModelNode, "id" | "name" | "provider">): ModelNode {
  return {
    slug: overrides.slug ?? overrides.id,
    releaseDate: "2026-01-15",
    intelligenceIndex: 55,
    codingIndex: 45,
    mathIndex: 72,
    benchmarks: {},
    priceInputPerM: 1,
    priceOutputPerM: 3,
    priceBlendedPerM: 1.5,
    outputTokensPerSecond: 180,
    timeToFirstTokenSeconds: 0.4,
    timeToFirstAnswerTokenSeconds: null,
    ...overrides,
  }
}

const snapshot: Snapshot = {
  syncedAt: "2026-04-01T00:00:00.000Z",
  models: [
    model({
      id: "llama-id",
      name: "Llama 3.1 70B",
      slug: "llama-3-1-70b",
      provider: { id: "meta", name: "Meta", slug: "meta" },
      intelligenceIndex: 48,
      priceBlendedPerM: 0.4,
      outputTokensPerSecond: 90,
    }),
    model({
      id: "gpt-id",
      name: "GPT-4o",
      slug: "gpt-4o",
      provider: { id: "openai", name: "OpenAI", slug: "openai" },
      intelligenceIndex: 62,
      codingIndex: 50,
      priceBlendedPerM: 6,
      outputTokensPerSecond: 200,
    }),
    model({
      id: "slow-id",
      name: "Slow Proprietary",
      slug: "slow-proprietary",
      provider: { id: "openai", name: "OpenAI", slug: "openai" },
      intelligenceIndex: 30,
      codingIndex: 10,
      mathIndex: 10,
      priceBlendedPerM: 8,
      outputTokensPerSecond: 20,
    }),
  ],
}

const params = (query: string) => new URLSearchParams(query)

function testListFilters() {
  const fast = queryModels(snapshot, null, parseModelListQuery(params("purpose=fast")))
  assert.deepEqual(fast.models.map((row) => row.id), ["gpt-id"])
  assert.equal(fast.models[0].openWeight, false)

  const open = queryModels(snapshot, null, parseModelListQuery(params("open=1&sort=name-asc")))
  assert.deepEqual(open.models.map((row) => row.id), ["llama-id"])
  assert.equal(open.models[0].openWeight, true)

  const search = queryModels(snapshot, null, parseModelListQuery(params("q=llama 70b")))
  assert.deepEqual(search.models.map((row) => row.id), ["llama-id"])

  const page = queryModels(snapshot, null, parseModelListQuery(params("limit=1&offset=1&sort=name-asc")))
  assert.equal(page.total, 3)
  assert.deepEqual(page.models.map((row) => row.id), ["llama-id"])
}

function testHubAndLookup() {
  const hub = {
    fetchedAt: "2026-04-02T00:00:00.000Z",
    models: { "llama-id": { hfId: "meta-llama/Llama-3.1-70B", fetchedAt: "2026-04-02T00:00:00.000Z" } },
  }
  const listed = queryModels(snapshot, hub, parseModelListQuery(params("q=llama")))
  assert.equal("hub" in listed.models[0], false)
  const withHub = queryModels(snapshot, hub, parseModelListQuery(params("q=llama&include=hub")))
  assert.equal(withHub.models[0].hub?.hfId, "meta-llama/Llama-3.1-70B")

  const bySlug = getPublicModel(snapshot, hub, "llama-3-1-70b")
  assert.equal(bySlug?.id, "llama-id")
  assert.equal(bySlug?.hub?.hfId, "meta-llama/Llama-3.1-70B")
  assert.equal(getPublicModel(snapshot, null, "missing"), null)
}

function testCompareProvidersGroups() {
  const compared = comparePublicModels(snapshot, null, ["gpt-4o", "missing", "llama-id"])
  assert.deepEqual(compared.models.map((row) => row.id), ["gpt-id", "llama-id"])
  assert.deepEqual(compared.missing, ["missing"])

  const providers = listPublicProviders(snapshot)
  const openai = providers.providers.find((row) => row.slug === "openai")
  assert.equal(openai?.count, 2)
  assert.equal(openai?.openCount, 0)

  const groups = listPublicGroups(snapshot, params("by=intelligence"))
  const frontier = groups.groups.find((group) => group.id === "intel-60")
  assert.equal(frontier?.label, "60+ · Frontier")
  assert.deepEqual(frontier?.modelIds, ["gpt-id"])
}

function testInvalidQueries() {
  assert.throws(() => parseModelListQuery(params("sort=nope")), (error: unknown) => {
    assert.ok(error instanceof CatalogQueryError)
    assert.equal(error.code, "INVALID_SORT")
    return true
  })
  assert.throws(() => parseModelListQuery(params("purpose=coding,nope")), (error: unknown) => {
    assert.ok(error instanceof CatalogQueryError)
    assert.equal(error.code, "INVALID_PURPOSE")
    return true
  })
  assert.throws(() => comparePublicModels(snapshot, null, ["a", "b", "c", "d", "e"]), (error: unknown) => {
    assert.ok(error instanceof CatalogQueryError)
    assert.equal(error.code, "TOO_MANY_MODELS")
    return true
  })
}

testListFilters()
testHubAndLookup()
testCompareProvidersGroups()
testInvalidQueries()
console.log("catalog-query tests passed")
