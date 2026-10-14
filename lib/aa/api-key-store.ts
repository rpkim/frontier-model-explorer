import { randomUUID } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import { BlobNotFoundError, get } from "@vercel/blob"
import {
  ApiKeyStoreError,
  MAX_ACTIVE_KEYS,
  findActiveKey,
  generateApiKey,
  normalizeKeyName,
  parseKeyStore,
  toPublicApiKey,
  type ApiKeyRecord,
  type ApiKeyStore,
  type PublicApiKey,
} from "./api-keys"
import { writeJsonBlob } from "./blob-json"

const BLOB_PATH = "frontier-models/api-keys.json"
const LOCAL_PATH = path.join(process.cwd(), ".data", "api-keys.json")
const CACHE_MS = 10_000

let cache: { expires: number; store: ApiKeyStore } | null = null
let writeChain: Promise<unknown> = Promise.resolve()

export function clearApiKeyCache(): void {
  cache = null
}

export async function isActiveApiKey(token: string): Promise<boolean> {
  const store = await readKeyStore()
  return findActiveKey(store, token) !== null
}

export async function listApiKeys(): Promise<PublicApiKey[]> {
  const store = await readKeyStore()
  return [...store.keys]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicApiKey)
}

export async function createApiKey(name: string): Promise<{ key: PublicApiKey; token: string }> {
  const cleanName = normalizeKeyName(name)
  const minted = generateApiKey()
  const record: ApiKeyRecord = {
    id: randomUUID(),
    name: cleanName,
    prefix: minted.prefix,
    hash: minted.hash,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  }
  await mutate((store) => {
    const active = store.keys.filter((key) => !key.revokedAt).length
    if (active >= MAX_ACTIVE_KEYS) throw new ApiKeyStoreError("TOO_MANY_KEYS")
    return { keys: [record, ...store.keys].slice(0, 200) }
  })
  return { key: toPublicApiKey(record), token: minted.token }
}

export async function revokeApiKey(id: string): Promise<PublicApiKey> {
  let revoked: ApiKeyRecord | null = null
  await mutate((store) => {
    const index = store.keys.findIndex((key) => key.id === id)
    if (index < 0) throw new ApiKeyStoreError("NOT_FOUND")
    const current = store.keys[index]
    if (current.revokedAt) {
      revoked = current
      return store
    }
    const next = { ...current, revokedAt: new Date().toISOString() }
    revoked = next
    const keys = store.keys.slice()
    keys[index] = next
    return { keys }
  })
  if (!revoked) throw new ApiKeyStoreError("NOT_FOUND")
  return toPublicApiKey(revoked)
}

async function mutate(change: (store: ApiKeyStore) => ApiKeyStore): Promise<void> {
  const run = writeChain.then(async () => {
    const store = await readKeyStoreUncached()
    const next = change(store)
    await writeKeyStore(next)
    cache = { expires: Date.now() + CACHE_MS, store: next }
  })
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  await run
}

async function readKeyStore(): Promise<ApiKeyStore> {
  const now = Date.now()
  if (cache && cache.expires > now) return cache.store
  const store = await readKeyStoreUncached()
  cache = { expires: now + CACHE_MS, store }
  return store
}

async function readKeyStoreUncached(): Promise<ApiKeyStore> {
  if (blobConfigured()) {
    const raw = await readKeyBlob()
    return parseKeyStore(raw)
  }
  if (process.env.NODE_ENV === "production") throw new ApiKeyStoreError("KEY_STORE_UNAVAILABLE")
  return readLocalStore()
}

async function writeKeyStore(store: ApiKeyStore): Promise<void> {
  if (blobConfigured()) {
    await writeJsonBlob(BLOB_PATH, store)
    return
  }
  if (process.env.NODE_ENV === "production") throw new ApiKeyStoreError("KEY_STORE_UNAVAILABLE")
  await mkdir(path.dirname(LOCAL_PATH), { recursive: true })
  await writeFile(LOCAL_PATH, JSON.stringify(store), "utf8")
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
}

async function readKeyBlob(): Promise<unknown | null> {
  try {
    const result = await get(BLOB_PATH, { access: "private" })
    if (!result) return null
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null
    console.error("[api-keys] blob read failed:", error)
    throw new ApiKeyStoreError("KEY_STORE_UNAVAILABLE")
  }
}

async function readLocalStore(): Promise<ApiKeyStore> {
  try {
    const text = await readFile(LOCAL_PATH, "utf8")
    return parseKeyStore(JSON.parse(text) as unknown)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { keys: [] }
    if (error instanceof ApiKeyStoreError) throw error
    throw new ApiKeyStoreError("KEY_STORE_INVALID")
  }
}
