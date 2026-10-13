import { createMcpHandler } from "mcp-handler"
import { catalogRateLimit } from "@/lib/aa/catalog-store"
import { registerCatalogServer } from "@/lib/aa/mcp-catalog"
import { catalogError, catalogOptions } from "@/lib/aa/public-http"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const handler = createMcpHandler(registerCatalogServer, {
  serverInfo: { name: "frontier-model-explorer", version: "0.1.0" },
  instructions:
    "Read-only Frontier Model Explorer catalog. Scores, prices, and API speed come from the Artificial Analysis snapshot. Hub size, dtype, and VRAM are cached separately. openWeight is a heuristic, not a license. Do not invent numbers; null means the snapshot had no value. Writes (sync, report, guide generation) are not available here.",
})

async function handle(req: Request): Promise<Response> {
  const limited = catalogRateLimit(req)
  if (!limited.allowed) {
    return catalogError(429, "RATE_LIMITED", "Too many catalog requests.", {
      "Retry-After": String(limited.retryAfterSec),
    })
  }
  const response = await handler(req)
  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", "*")
  headers.set("Access-Control-Expose-Headers", "Retry-After, Mcp-Session-Id")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export function GET(req: Request) {
  return handle(req)
}

export function POST(req: Request) {
  return handle(req)
}

export function DELETE(req: Request) {
  return handle(req)
}

export function OPTIONS() {
  return catalogOptions()
}
