import { catalogJson, catalogOptions, requireCatalogAccess } from "@/lib/aa/public-http"

export const dynamic = "force-dynamic"

const discovery = {
  name: "Frontier Model Explorer",
  version: "v1",
  mcp: "/api/mcp",
  auth: "Authorization: Bearer <api key> or X-Api-Key. Issue keys at /admin.",
  attribution:
    "Scores, prices, and API speed come from the Artificial Analysis snapshot. Size, dtype, and VRAM come from the cached Hugging Face Hub snapshot. openWeight is a heuristic, not a license.",
  endpoints: [
    {
      method: "GET",
      path: "/api/v1/models",
      query: ["q", "providers", "provider", "open", "purpose", "sort", "limit", "offset", "include"],
    },
    { method: "GET", path: "/api/v1/models/{id}" },
    { method: "GET", path: "/api/v1/providers" },
    { method: "GET", path: "/api/v1/groups", query: ["by", "q", "providers", "provider", "open", "purpose", "sort"] },
    { method: "GET", path: "/api/v1/compare", query: ["models"] },
  ],
} as const

export async function GET(req: Request) {
  const denied = await requireCatalogAccess(req)
  if (denied) return denied
  return catalogJson(discovery)
}

export function OPTIONS() {
  return catalogOptions()
}
