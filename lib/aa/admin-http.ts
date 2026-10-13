import { ApiKeyStoreError } from "./api-keys"
import { isAdminRequest } from "./admin-session"

export function adminJson(body: unknown, status = 200, setCookie?: string): Response {
  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  if (setCookie) headers["Set-Cookie"] = setCookie
  return Response.json(body, { status, headers })
}

export function requireAdmin(req: Request): Response | null {
  if (!process.env.SYNC_PASSWORD?.trim()) {
    return adminJson({ error: "SYNC_PASSWORD_NOT_CONFIGURED" }, 503)
  }
  if (!isAdminRequest(req)) return adminJson({ error: "UNAUTHORIZED" }, 401)
  return null
}

export function adminStoreError(error: unknown): Response | null {
  if (!(error instanceof ApiKeyStoreError)) return null
  if (error.code === "NOT_FOUND") return adminJson({ error: error.code }, 404)
  if (error.code === "INVALID_NAME" || error.code === "TOO_MANY_KEYS") return adminJson({ error: error.code }, 400)
  if (error.code === "KEY_STORE_UNAVAILABLE" || error.code === "KEY_STORE_INVALID") {
    return adminJson({ error: error.code }, 503)
  }
  return adminJson({ error: error.code }, 500)
}
