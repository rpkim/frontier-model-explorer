import assert from "node:assert/strict"
import {
  ApiKeyStoreError,
  findActiveKey,
  generateApiKey,
  hashApiKey,
  normalizeKeyName,
  parseKeyStore,
  type ApiKeyRecord,
} from "./api-keys"
import { createAdminSessionToken, verifyAdminSessionToken } from "./admin-session"

function record(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  const minted = generateApiKey()
  return {
    id: "key-1",
    name: "bot",
    prefix: minted.prefix,
    hash: minted.hash,
    createdAt: "2026-10-13T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  }
}

const minted = generateApiKey()
const live = record({ hash: minted.hash, prefix: minted.prefix })
const store = { keys: [live, record({ id: "other" })] }

assert.equal(findActiveKey(store, minted.token)?.id, "key-1")
assert.equal(findActiveKey(store, minted.token.slice(0, -2) + "xx"), null)
assert.equal(findActiveKey(store, "not-a-key"), null)
assert.equal(findActiveKey({ keys: [{ ...live, revokedAt: "2026-10-13T01:00:00.000Z" }] }, minted.token), null)
assert.equal(hashApiKey(minted.token), minted.hash)
assert.equal(minted.token.startsWith("fme_"), true)
assert.equal(minted.prefix, minted.token.slice(0, 12))

assert.equal(normalizeKeyName("  research   bot  "), "research bot")
assert.throws(() => normalizeKeyName(""), (error: unknown) => error instanceof ApiKeyStoreError && error.code === "INVALID_NAME")
assert.throws(() => normalizeKeyName("x".repeat(61)), (error: unknown) => error instanceof ApiKeyStoreError && error.code === "INVALID_NAME")
assert.throws(() => normalizeKeyName(12), (error: unknown) => error instanceof ApiKeyStoreError && error.code === "INVALID_NAME")

const parsed = parseKeyStore({
  keys: [live, { id: 1 }, { id: "skip" }, null],
})
assert.equal(parsed.keys.length, 1)
assert.equal(parsed.keys[0]?.hash, live.hash)
assert.throws(() => parseKeyStore({ nope: true }), (error: unknown) => error instanceof ApiKeyStoreError && error.code === "KEY_STORE_INVALID")
assert.deepEqual(parseKeyStore(null), { keys: [] })

process.env.SYNC_PASSWORD = "test-sync-password-value"
const session = createAdminSessionToken()
assert.equal(typeof session, "string")
assert.equal(verifyAdminSessionToken(session), true)
assert.equal(verifyAdminSessionToken(`${session}x`), false)
const [payload] = String(session).split(".")
assert.equal(verifyAdminSessionToken(`${payload}.aaaaaaaa`), false)
assert.equal(verifyAdminSessionToken("1.aaaa"), false)
const previous = process.env.SYNC_PASSWORD
process.env.SYNC_PASSWORD = "rotated"
assert.equal(verifyAdminSessionToken(session), false)
process.env.SYNC_PASSWORD = previous
assert.equal(verifyAdminSessionToken(session), true)
delete process.env.SYNC_PASSWORD
assert.equal(createAdminSessionToken(), null)
assert.equal(verifyAdminSessionToken(session), false)

console.log("api-keys tests passed")
