import { checkRateLimit, clientIpFromRequest } from "./rate-limit"
import { readHubSnapshot } from "./hub-snapshot"
import { readSnapshot } from "./snapshot"
import type { HubSnapshot, Snapshot } from "./types"

const TTL_MS = 15_000
const RATE_LIMIT = 180
const RATE_WINDOW_MS = 60_000

type CacheEntry = {
  expires: number
  snapshot: Snapshot | null
  hub: HubSnapshot | null
}

let cache: CacheEntry | null = null

export async function loadCatalog(): Promise<{ snapshot: Snapshot | null; hub: HubSnapshot | null }> {
  const now = Date.now()
  if (cache && cache.expires > now) {
    return { snapshot: cache.snapshot, hub: cache.hub }
  }
  const [snapshot, hub] = await Promise.all([readSnapshot(), readHubSnapshot()])
  cache = { expires: now + TTL_MS, snapshot, hub }
  return { snapshot, hub }
}

/** Clears the in-process catalog cache. Used by tests. */
export function clearCatalogCache(): void {
  cache = null
}

export function catalogRateLimit(req: Request): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const ip = clientIpFromRequest(req)
  return checkRateLimit(`catalog:${ip}`, { limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS })
}
