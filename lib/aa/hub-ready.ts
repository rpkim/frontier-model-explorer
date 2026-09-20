import type { HubDetail } from "./types"

const BLOCKING_HUB_ERRORS = new Set([
  "unmapped",
  "not_found",
  "timeout",
  "rate_limited",
  "fetch_failed",
])

/** True when Hub details have enough size/VRAM signal to size a serving guide. */
export function hasUsableHubDetail(detail: HubDetail | null | undefined): boolean {
  if (!detail) return false
  if (detail.error && BLOCKING_HUB_ERRORS.has(detail.error)) return false
  return (
    (detail.parameterCount != null && detail.parameterCount > 0) ||
    (detail.modelSizeBytes != null && detail.modelSizeBytes > 0) ||
    Boolean(detail.vramEstimate)
  )
}
