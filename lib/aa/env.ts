/**
 * Server-only feature flags and env helpers.
 * Defaults favor safe behavior when the repo is public and env is easy to misconfigure.
 */

export function isAgentEnabled(): boolean {
  return process.env.AGENT_ENABLED === "true"
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim())
}

export function isSyncPasswordConfigured(): boolean {
  return Boolean(process.env.SYNC_PASSWORD?.trim())
}
