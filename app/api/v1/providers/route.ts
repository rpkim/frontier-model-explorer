import { listPublicProviders } from "@/lib/aa/catalog-query"
import { catalogJson, catalogOptions, withCatalogRead } from "@/lib/aa/public-http"

export const dynamic = "force-dynamic"

export function GET(req: Request) {
  return withCatalogRead(req, ({ snapshot }) => catalogJson(listPublicProviders(snapshot)))
}

export function OPTIONS() {
  return catalogOptions()
}
