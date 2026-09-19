"use server"

import { revalidatePath } from "next/cache"
import { AAApiError, fetchAAModels } from "@/lib/aa/client"
import { normalizeModels } from "@/lib/aa/normalize"
import { requireSyncPassword } from "@/lib/aa/protect"
import { readSnapshot, writeSnapshot } from "@/lib/aa/snapshot"
import type { Snapshot } from "@/lib/aa/types"

export interface SyncResult {
  ok: boolean
  error?: string
  snapshot?: Snapshot
}

export async function syncModels(password: string): Promise<SyncResult> {
  const auth = requireSyncPassword(password)
  if (!auth.ok) return { ok: false, error: auth.error }

  try {
    const raw = await fetchAAModels()
    const models = normalizeModels(raw)
    const snapshot = await writeSnapshot(models)
    revalidatePath("/")
    return { ok: true, snapshot }
  } catch (error) {
    console.error("[v0] syncModels failed:", error)
    if (error instanceof AAApiError) {
      if (error.message.includes("not configured")) return { ok: false, error: "AA_API_NOT_CONFIGURED" }
      return { ok: false, error: error.status ? `AA_API_HTTP_${error.status}` : "AA_API_ERROR" }
    }
    return { ok: false, error: "SYNC_FAILED" }
  }
}

export async function getLatestSnapshot(): Promise<Snapshot | null> {
  return readSnapshot()
}
