import { rawApiResponseSchema, type RawModel } from "./types"

const API_URL = "https://artificialanalysis.ai/api/v2/data/llms/models"

export class AAApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = "AAApiError"
  }
}

/**
 * Fetches the full frontier LLM catalog from the Artificial Analysis Data API.
 * Requires ARTIFICIALANALYSIS_API_KEY to be set in the environment.
 */
export async function fetchAAModels(): Promise<RawModel[]> {
  const key = process.env.ARTIFICIALANALYSIS_API_KEY
  if (!key) {
    throw new AAApiError("ARTIFICIALANALYSIS_API_KEY is not configured")
  }

  const res = await fetch(API_URL, {
    headers: { "x-api-key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body?.error ?? ""
    } catch {
      // ignore parse errors, fall through with empty detail
    }
    throw new AAApiError(detail || `Artificial Analysis API request failed (${res.status})`, res.status)
  }

  const json = await res.json()
  const parsed = rawApiResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new AAApiError("Unexpected response shape from Artificial Analysis API")
  }

  return parsed.data.data
}
