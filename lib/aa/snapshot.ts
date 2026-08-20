import { get, put } from "@vercel/blob"
import type { ModelNode, Snapshot } from "./types"

const SNAPSHOT_PATHNAME = "frontier-models/latest-snapshot.json"

export async function readSnapshot(): Promise<Snapshot | null> {
  try {
    const result = await get(SNAPSHOT_PATHNAME, { access: "private" })
    if (!result) return null

    const text = await new Response(result.stream).text()
    return JSON.parse(text) as Snapshot
  } catch (error) {
    console.error("[v0] Failed to read snapshot from Blob:", error)
    return null
  }
}

export async function writeSnapshot(models: ModelNode[]): Promise<Snapshot> {
  const snapshot: Snapshot = {
    syncedAt: new Date().toISOString(),
    models,
  }

  await put(SNAPSHOT_PATHNAME, JSON.stringify(snapshot), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return snapshot
}
