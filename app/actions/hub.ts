"use server"

import { revalidatePath } from "next/cache"
import { refreshHubDetails, HubRefreshError, type HubRefreshResult } from "@/lib/aa/hub"
import { readHubSnapshot } from "@/lib/aa/hub-snapshot"
import { requireSyncPassword } from "@/lib/aa/protect"
import type { HubSnapshot } from "@/lib/aa/types"

export interface HubSyncResult {
  ok: boolean
  error?: string
  snapshot?: HubSnapshot
  stats?: HubRefreshResult["stats"]
}

export async function getLatestHubSnapshot(): Promise<HubSnapshot | null> {
  return readHubSnapshot()
}

export async function syncHubDetails(password: string, modelId?: string): Promise<HubSyncResult> {
  const auth = requireSyncPassword(password)
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const result = await refreshHubDetails(modelId ? { modelId } : undefined)
    revalidatePath("/")
    return { ok: true, snapshot: result.snapshot, stats: result.stats }
  } catch (error) {
    const message = error instanceof HubRefreshError ? error.code : "UNKNOWN_HUB_ERROR"
    console.error("[v0] syncHubDetails failed:", error)
    return { ok: false, error: message }
  }
}
