import { getPublicModel } from "@/lib/aa/catalog-query"
import { catalogError, catalogJson, catalogOptions, withCatalogRead } from "@/lib/aa/public-http"

export const dynamic = "force-dynamic"

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withCatalogRead(req, async ({ snapshot, hub }) => {
    const { id } = await ctx.params
    const model = getPublicModel(snapshot, hub, id)
    if (!model) {
      return catalogError(404, "MODEL_NOT_FOUND", `No model found for ${id}.`)
    }
    return catalogJson({ syncedAt: snapshot.syncedAt, model })
  })
}

export function OPTIONS() {
  return catalogOptions()
}
