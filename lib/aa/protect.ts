import { timingSafeEqual } from "crypto"

export type SyncPasswordError = "SYNC_PASSWORD_NOT_CONFIGURED" | "INVALID_SYNC_PASSWORD"

function safeEqualUtf8(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function requireSyncPassword(
  password: string,
): { ok: true } | { ok: false; error: SyncPasswordError } {
  const expected = process.env.SYNC_PASSWORD
  if (!expected) return { ok: false, error: "SYNC_PASSWORD_NOT_CONFIGURED" }
  if (!safeEqualUtf8(password, expected)) return { ok: false, error: "INVALID_SYNC_PASSWORD" }
  return { ok: true }
}
