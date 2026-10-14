import { assertGroupQuery, CatalogQueryError, listPublicGroups } from "@/lib/aa/catalog-query"
import { catalogError, catalogJson, catalogOptions, withCatalogRead } from "@/lib/aa/public-http"

export const dynamic = "force-dynamic"

export function GET(req: Request) {
  const params = new URL(req.url).searchParams
  params.delete("limit")
  params.delete("offset")
  params.delete("include")
  try {
    assertGroupQuery(params)
  } catch (error) {
    if (error instanceof CatalogQueryError) return catalogError(400, error.code, error.message)
    throw error
  }
  return withCatalogRead(req, ({ snapshot }) => catalogJson(listPublicGroups(snapshot, params)))
}

export function OPTIONS() {
  return catalogOptions()
}
