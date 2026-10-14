import { adminJson } from "@/lib/aa/admin-http"
import {
  adminSessionClearCookie,
  adminSessionSetCookie,
  createAdminSessionToken,
  isAdminRequest,
} from "@/lib/aa/admin-session"
import { checkRateLimit, clientIpFromRequest } from "@/lib/aa/rate-limit"
import { requireSyncPassword } from "@/lib/aa/protect"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  return adminJson({ authenticated: isAdminRequest(req) })
}

export async function POST(req: Request) {
  const limited = checkRateLimit(`admin-login:${clientIpFromRequest(req)}`, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
  })
  if (!limited.allowed) {
    return adminJson({ error: "RATE_LIMITED" }, 429)
  }

  let body: { password?: unknown }
  try {
    body = await req.json()
  } catch {
    return adminJson({ error: "INVALID_REQUEST" }, 400)
  }

  const password = typeof body.password === "string" ? body.password : ""
  const auth = requireSyncPassword(password)
  if (!auth.ok) {
    const status = auth.error === "SYNC_PASSWORD_NOT_CONFIGURED" ? 503 : 401
    return adminJson({ error: auth.error }, status)
  }

  const token = createAdminSessionToken()
  if (!token) return adminJson({ error: "SYNC_PASSWORD_NOT_CONFIGURED" }, 503)
  return adminJson({ authenticated: true }, 200, adminSessionSetCookie(token))
}

export async function DELETE() {
  return adminJson({ authenticated: false }, 200, adminSessionClearCookie())
}
