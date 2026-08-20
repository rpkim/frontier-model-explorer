export type SyncPasswordError = "SYNC_PASSWORD_NOT_CONFIGURED" | "INVALID_SYNC_PASSWORD"

export function requireSyncPassword(
  password: string,
): { ok: true } | { ok: false; error: SyncPasswordError } {
  const expected = process.env.SYNC_PASSWORD
  if (!expected) return { ok: false, error: "SYNC_PASSWORD_NOT_CONFIGURED" }
  if (password !== expected) return { ok: false, error: "INVALID_SYNC_PASSWORD" }
  return { ok: true }
}
