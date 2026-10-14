import { adminJson, adminStoreError, requireAdmin } from "@/lib/aa/admin-http"
import { createApiKey, listApiKeys } from "@/lib/aa/api-key-store"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    return adminJson({ keys: await listApiKeys() })
  } catch (error) {
    const response = adminStoreError(error)
    if (response) return response
    console.error("[admin] list keys failed:", error)
    return adminJson({ error: "KEY_STORE_UNAVAILABLE" }, 503)
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied

  let body: { name?: unknown }
  try {
    body = await req.json()
  } catch {
    return adminJson({ error: "INVALID_REQUEST" }, 400)
  }

  try {
    const created = await createApiKey(typeof body.name === "string" ? body.name : "")
    return adminJson(created, 201)
  } catch (error) {
    const response = adminStoreError(error)
    if (response) return response
    console.error("[admin] create key failed:", error)
    return adminJson({ error: "KEY_STORE_UNAVAILABLE" }, 503)
  }
}
