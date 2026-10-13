import { createHash, randomBytes, timingSafeEqual } from "crypto"

export const API_KEY_PREFIX = "fme_"
export const MAX_ACTIVE_KEYS = 25

export interface ApiKeyRecord {
  id: string
  name: string
  /** First characters of the token, safe to show in the admin list. */
  prefix: string
  /** SHA-256 hex of the full token. */
  hash: string
  createdAt: string
  revokedAt: string | null
}

export interface ApiKeyStore {
  keys: ApiKeyRecord[]
}

export interface PublicApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  revokedAt: string | null
}

export class ApiKeyStoreError extends Error {
  readonly code: "KEY_STORE_UNAVAILABLE" | "KEY_STORE_INVALID" | "TOO_MANY_KEYS" | "INVALID_NAME" | "NOT_FOUND"

  constructor(code: ApiKeyStoreError["code"]) {
    super(code)
    this.name = "ApiKeyStoreError"
    this.code = code
  }
}

export function generateApiKey(): { token: string; prefix: string; hash: string } {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`
  return { token, prefix: token.slice(0, 12), hash: hashApiKey(token) }
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function toPublicApiKey(record: ApiKeyRecord): PublicApiKey {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt,
  }
}

export function normalizeKeyName(raw: unknown): string {
  if (typeof raw !== "string") throw new ApiKeyStoreError("INVALID_NAME")
  const name = raw.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > 60) throw new ApiKeyStoreError("INVALID_NAME")
  if (/[\u0000-\u001f]/.test(name)) throw new ApiKeyStoreError("INVALID_NAME")
  return name
}

export function findActiveKey(store: ApiKeyStore, token: string): ApiKeyRecord | null {
  if (!token.startsWith(API_KEY_PREFIX) || token.length < 20) return null
  const hash = hashApiKey(token)
  const hashBuf = Buffer.from(hash, "utf8")
  for (const record of store.keys) {
    if (record.revokedAt) continue
    const stored = Buffer.from(record.hash, "utf8")
    if (stored.length !== hashBuf.length) continue
    if (timingSafeEqual(stored, hashBuf)) return record
  }
  return null
}

export function parseKeyStore(raw: unknown): ApiKeyStore {
  if (raw == null) return { keys: [] }
  if (typeof raw !== "object" || !Array.isArray((raw as { keys?: unknown }).keys)) {
    throw new ApiKeyStoreError("KEY_STORE_INVALID")
  }
  const keys: ApiKeyRecord[] = []
  for (const entry of (raw as { keys: unknown[] }).keys) {
    if (!isRecord(entry)) continue
    if (typeof entry.id !== "string" || typeof entry.name !== "string") continue
    if (typeof entry.prefix !== "string" || typeof entry.hash !== "string") continue
    if (typeof entry.createdAt !== "string") continue
    keys.push({
      id: entry.id,
      name: entry.name,
      prefix: entry.prefix,
      hash: entry.hash,
      createdAt: entry.createdAt,
      revokedAt: typeof entry.revokedAt === "string" ? entry.revokedAt : null,
    })
  }
  return { keys }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
