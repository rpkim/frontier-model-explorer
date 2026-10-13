import { ResourceNotFoundError, ResourceTemplate, type McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import {
  CatalogQueryError,
  comparePublicModels,
  getPublicModel,
  GROUP_BY_KEYS,
  listPublicGroups,
  listPublicProviders,
  parseModelListQuery,
  queryModels,
} from "./catalog-query"
import { loadCatalog } from "./catalog-store"
import { VALID_PURPOSES } from "./filter"
import { VALID_SORTS } from "./sort"

const sortSchema = z.enum(VALID_SORTS)
const purposeSchema = z.enum(VALID_PURPOSES)
const groupBySchema = z.enum(GROUP_BY_KEYS)

type ToolResult = {
  content: { type: "text"; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export function registerCatalogServer(server: McpServer): void {
  server.registerTool(
    "list_models",
    {
      title: "List models",
      description:
        "List frontier models from the synced catalog. Filters match the explorer: provider slugs, open vs proprietary (a heuristic), purpose presets, and sort. Pages with limit (max 50) and offset. Set includeHub to attach cached Hugging Face size, dtype, and VRAM.",
      inputSchema: z.object({
        q: z.string().optional().describe("Case-insensitive words matched against name, slug, id, and provider."),
        providers: z.array(z.string()).optional().describe("Provider slugs. Empty means every provider."),
        open: z.enum(["all", "open", "proprietary"]).optional(),
        purposes: z
          .array(purposeSchema)
          .optional()
          .describe("coding, reasoning, math, cheap, or fast. All listed purposes must match."),
        sort: sortSchema.optional(),
        limit: z.number().int().min(1).max(50).optional(),
        offset: z.number().int().min(0).optional(),
        includeHub: z.boolean().optional(),
      }),
    },
    async (args) =>
      run(async () => {
        const params = new URLSearchParams()
        if (args.q) params.set("q", args.q)
        if (args.providers?.length) params.set("providers", args.providers.join(","))
        if (args.open === "open") params.set("open", "1")
        if (args.open === "proprietary") params.set("open", "0")
        if (args.purposes?.length) params.set("purpose", args.purposes.join(","))
        if (args.sort) params.set("sort", args.sort)
        if (args.limit != null) params.set("limit", String(args.limit))
        if (args.offset != null) params.set("offset", String(args.offset))
        if (args.includeHub) params.set("include", "hub")
        const snapshot = await requireSnapshot()
        return queryModels(snapshot.snapshot, snapshot.hub, parseModelListQuery(params, { defaultLimit: 20, maxLimit: 50 }))
      }),
  )

  server.registerTool(
    "get_model",
    {
      title: "Get model",
      description:
        "Fetch one catalog model by id, or by slug when the slug is unique. Includes the open-weight heuristic and cached Hub details when present.",
      inputSchema: z.object({
        id: z.string().min(1).describe("Catalog model id, or a unique slug."),
      }),
    },
    async ({ id }) =>
      run(async () => {
        const { snapshot, hub } = await requireSnapshot()
        const model = getPublicModel(snapshot, hub, id)
        if (!model) throw new CatalogQueryError("MODEL_NOT_FOUND", `No model found for ${id}.`)
        return { syncedAt: snapshot.syncedAt, model }
      }),
  )

  server.registerTool(
    "compare_models",
    {
      title: "Compare models",
      description: "Compare 1 to 4 models side by side. Ids that are missing are returned in missing and omitted from models.",
      inputSchema: z.object({
        ids: z.array(z.string().min(1)).min(1).max(4),
      }),
    },
    async ({ ids }) =>
      run(async () => {
        const { snapshot, hub } = await requireSnapshot()
        return comparePublicModels(snapshot, hub, ids)
      }),
  )

  server.registerTool(
    "list_providers",
    {
      title: "List providers",
      description: "List catalog providers with model counts and how many of those models the open-weight heuristic accepts.",
      inputSchema: z.object({}),
    },
    async () =>
      run(async () => {
        const { snapshot } = await requireSnapshot()
        return listPublicProviders(snapshot)
      }),
  )

  server.registerTool(
    "list_groups",
    {
      title: "List groups",
      description:
        "Group the catalog the way the mind map does: provider, intelligence, price, speed, or release. Returns group id, English label, count, and model ids. Accepts the same filters as list_models.",
      inputSchema: z.object({
        by: groupBySchema.optional(),
        q: z.string().optional(),
        providers: z.array(z.string()).optional(),
        open: z.enum(["all", "open", "proprietary"]).optional(),
        purposes: z.array(purposeSchema).optional(),
        sort: sortSchema.optional(),
      }),
    },
    async (args) =>
      run(async () => {
        const params = new URLSearchParams()
        if (args.by) params.set("by", args.by)
        if (args.q) params.set("q", args.q)
        if (args.providers?.length) params.set("providers", args.providers.join(","))
        if (args.open === "open") params.set("open", "1")
        if (args.open === "proprietary") params.set("open", "0")
        if (args.purposes?.length) params.set("purpose", args.purposes.join(","))
        if (args.sort) params.set("sort", args.sort)
        const { snapshot } = await requireSnapshot()
        return listPublicGroups(snapshot, params)
      }),
  )

  server.registerResource(
    "catalog-summary",
    "catalog://summary",
    {
      title: "Catalog summary",
      description: "Synced time, model count, and provider count for the stored snapshot.",
      mimeType: "application/json",
    },
    async (uri) => {
      const { snapshot } = await requireSnapshot()
      const body = {
        syncedAt: snapshot.syncedAt,
        modelCount: snapshot.models.length,
        providerCount: new Set(snapshot.models.map((model) => model.provider.slug)).size,
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(body) }] }
    },
  )

  server.registerResource(
    "catalog-model",
    new ResourceTemplate("catalog://models/{id}", { list: undefined }),
    {
      title: "Catalog model",
      description: "One model as JSON, including Hub details when cached. {id} is the catalog id or a unique slug.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const rawId = variables.id
      const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? ""
      const { snapshot, hub } = await requireSnapshot()
      const model = getPublicModel(snapshot, hub, id)
      if (!model) throw new ResourceNotFoundError(uri.href, `No model found for ${id}.`)
      const body = { syncedAt: snapshot.syncedAt, model }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(body) }] }
    },
  )
}

async function requireSnapshot() {
  const loaded = await loadCatalog()
  if (!loaded.snapshot || loaded.snapshot.models.length === 0) {
    throw new CatalogQueryError("NO_SNAPSHOT", "No catalog snapshot is stored yet. Sync the explorer, then retry.")
  }
  return { snapshot: loaded.snapshot, hub: loaded.hub }
}

async function run(fn: () => Promise<object>): Promise<ToolResult> {
  try {
    const data = await fn()
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data as Record<string, unknown>,
    }
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return {
        isError: true,
        content: [{ type: "text", text: `${error.code}: ${error.message}` }],
      }
    }
    throw error
  }
}
