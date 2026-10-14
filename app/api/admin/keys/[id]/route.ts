import { adminJson, adminStoreError, requireAdmin } from "@/lib/aa/admin-http"
import { revokeApiKey } from "@/lib/aa/api-key-store"

export const dynamic = "force-dynamic"

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { id } = await ctx.params
  try {
    const key = await revokeApiKey(id)
    return adminJson({ key })
  } catch (error) {
    const response = adminStoreError(error)
    if (response) return response
    console.error("[admin] revoke key failed:", error)
    return adminJson({ error: "KEY_STORE_UNAVAILABLE" }, 503)
  }
}
