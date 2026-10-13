import { createHmac, timingSafeEqual } from "crypto"

const COOKIE = "fme_admin"
const MAX_AGE_SEC = 60 * 60 * 12

export function createAdminSessionToken(): string | null {
  const secret = process.env.SYNC_PASSWORD
  if (!secret) return null
  const payload = String(Date.now() + MAX_AGE_SEC * 1000)
  const sig = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  const secret = process.env.SYNC_PASSWORD
  if (!secret || !token) return false
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const exp = Number(payload)
  if (!Number.isFinite(exp) || Date.now() > exp) return false
  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  const provided = Buffer.from(sig)
  const wanted = Buffer.from(expected)
  if (provided.length !== wanted.length) return false
  return timingSafeEqual(provided, wanted)
}

export function adminTokenFromRequest(req: Request): string | null {
  const raw = req.headers.get("cookie")
  if (!raw) return null
  for (const part of raw.split(";")) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    if (trimmed.slice(0, eq) !== COOKIE) continue
    return decodeURIComponent(trimmed.slice(eq + 1))
  }
  return null
}

export function adminSessionSetCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secureFlag()}`
}

export function adminSessionClearCookie(): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag()}`
}

export function isAdminRequest(req: Request): boolean {
  return verifyAdminSessionToken(adminTokenFromRequest(req))
}

function secureFlag(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : ""
}
