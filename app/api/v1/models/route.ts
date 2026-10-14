import { CatalogQueryError, parseModelListQuery, queryModels } from "@/lib/aa/catalog-query"
import { catalogError, catalogJson, catalogOptions, withCatalogRead } from "@/lib/aa/public-http"

export const dynamic = "force-dynamic"

export function GET(req: Request) {
  const params = new URL(req.url).searchParams
  let query
  try {
    query = parseModelListQuery(params)
  } catch (error) {
    if (error instanceof CatalogQueryError) return catalogError(400, error.code, error.message)
    throw error
  }
  return withCatalogRead(req, ({ snapshot, hub }) => catalogJson(queryModels(snapshot, hub, query)))
}

export function OPTIONS() {
  return catalogOptions()
}
