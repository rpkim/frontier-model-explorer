import { revalidatePath } from "next/cache"
import { HubRefreshError, refreshHubDetails } from "@/lib/aa/hub"
import { requireSyncPassword } from "@/lib/aa/protect"

export const maxDuration = 300
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  let body: { password?: unknown; modelId?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 })
  }

  const password = typeof body.password === "string" ? body.password : ""
  const auth = requireSyncPassword(password)
  if (!auth.ok) {
    const status = auth.error === "SYNC_PASSWORD_NOT_CONFIGURED" ? 503 : 401
    return Response.json({ ok: false, error: auth.error }, { status })
  }

  const modelId = typeof body.modelId === "string" && body.modelId ? body.modelId : undefined

  try {
    const result = await refreshHubDetails(modelId ? { modelId } : undefined)
    revalidatePath("/")
    return Response.json({
      ok: true,
      fetchedAt: result.snapshot.fetchedAt,
      stats: result.stats,
    })
  } catch (error) {
    const code = error instanceof HubRefreshError ? error.code : "UNKNOWN_HUB_ERROR"
    console.error("[v0] Hub detail refresh failed:", error)
    const status =
      code === "NO_SNAPSHOT" || code === "MODEL_NOT_FOUND" || code === "NOT_OPEN"
        ? 400
        : code === "HUB_STORE_FAILED"
          ? 503
          : 500
    return Response.json({ ok: false, error: code }, { status })
  }
}
