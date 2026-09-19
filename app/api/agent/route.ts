import { google } from "@ai-sdk/google"
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"
import { getLatestSnapshot } from "@/app/actions/sync"
import { CATALOG_FIELD_LEGEND, serializeCatalogForAgent } from "@/lib/aa/catalog-for-agent"
import { isAgentEnabled, isGeminiConfigured } from "@/lib/aa/env"
import { clientIpFromRequest, checkRateLimit } from "@/lib/aa/rate-limit"
import { getRequestLocale } from "@/lib/i18n/server"
import type { Locale } from "@/lib/i18n/locales"

export const maxDuration = 60

const AGENT_RATE = { limit: 30, windowMs: 60_000 }

const REPLY_LANGUAGE: Record<Locale, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  zh: "Simplified Chinese",
}

function buildSystemPrompt({
  catalogJson,
  modelCount,
  syncedAt,
  truncatedFields,
  locale,
}: {
  catalogJson: string
  modelCount: number
  syncedAt: string
  truncatedFields: boolean
  locale: Locale
}): string {
  const truncationNote = truncatedFields
    ? `Per-model benchmark scores (field b) were omitted so all ${modelCount} models could fit. Indexes, prices, speed, and release dates are still present for every model.`
    : `The catalog includes all ${modelCount} models with available indexes, prices, speed, and benchmark scores.`

  return [
    "You are the in-app assistant for Frontier Model Explorer.",
    "Answer questions using ONLY the Artificial Analysis snapshot catalog provided below.",
    "Do not invent models, providers, scores, prices, dates, or benchmarks that are not in the catalog.",
    "If a value is missing or a model is not listed, say it is unknown in this snapshot.",
    "You may rank, filter, and compare using the provided fields. Prefer concise, specific answers that name models from the catalog.",
    `Respond in ${REPLY_LANGUAGE[locale]}.`,
    `Snapshot synced at: ${syncedAt}. Catalog size: ${modelCount} models.`,
    truncationNote,
    `Field legend: ${CATALOG_FIELD_LEGEND}.`,
    "Catalog JSON:",
    catalogJson,
  ].join("\n")
}

export async function POST(req: Request) {
  if (!isAgentEnabled()) {
    return new Response("AGENT_DISABLED", { status: 503 })
  }

  if (!isGeminiConfigured()) {
    return new Response("LLM_KEY_MISSING", { status: 503 })
  }

  const ip = clientIpFromRequest(req)
  const rate = checkRateLimit(`agent:${ip}`, AGENT_RATE)
  if (!rate.allowed) {
    return new Response("RATE_LIMITED", {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    })
  }

  const snapshot = await getLatestSnapshot()
  if (!snapshot || snapshot.models.length === 0) {
    return new Response("NO_SNAPSHOT", { status: 400 })
  }

  let body: { messages?: UIMessage[] }
  try {
    body = await req.json()
  } catch {
    return new Response("INVALID_REQUEST", { status: 400 })
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : []
  if (messages.length === 0) {
    return new Response("INVALID_REQUEST", { status: 400 })
  }

  const locale = await getRequestLocale()
  const catalog = serializeCatalogForAgent(snapshot.models)

  const result = streamText({
    model: google("gemini-3.5-flash"),
    system: buildSystemPrompt({
      catalogJson: catalog.json,
      modelCount: catalog.modelCount,
      syncedAt: snapshot.syncedAt,
      truncatedFields: catalog.truncatedFields,
      locale,
    }),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
