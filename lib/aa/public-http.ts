import { CatalogQueryError } from "./catalog-query"
import { catalogRateLimit, loadCatalog } from "./catalog-store"
import type { HubSnapshot, Snapshot } from "./types"

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Retry-After, Mcp-Session-Id",
}

export function catalogOptions(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

export function catalogJson(body: unknown, status = 200, extra?: Record<string, string>): Response {
  return Response.json(body, {
    status,
    headers: {
      ...CORS,
      "Cache-Control": status === 200 ? "public, max-age=15" : "no-store",
      ...extra,
    },
  })
}

export function catalogError(status: number, code: string, message: string, extra?: Record<string, string>): Response {
  return catalogJson({ error: code, message }, status, extra)
}

export async function withCatalogRead(
  req: Request,
  run: (catalog: { snapshot: Snapshot; hub: HubSnapshot | null }) => Response | Promise<Response>,
): Promise<Response> {
  const limited = catalogRateLimit(req)
  if (!limited.allowed) {
    return catalogError(429, "RATE_LIMITED", "Too many catalog requests.", {
      "Retry-After": String(limited.retryAfterSec),
    })
  }

  try {
    const { snapshot, hub } = await loadCatalog()
    if (!snapshot || snapshot.models.length === 0) {
      return catalogError(503, "NO_SNAPSHOT", "No catalog snapshot is stored yet. Sync the explorer, then retry.")
    }
    return await run({ snapshot, hub })
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return catalogError(400, error.code, error.message)
    }
    console.error("[catalog] read failed:", error)
    return catalogError(500, "CATALOG_READ_FAILED", "The catalog could not be read.")
  }
}
