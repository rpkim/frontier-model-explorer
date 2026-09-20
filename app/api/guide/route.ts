import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { getLatestHubSnapshot } from "@/app/actions/hub"
import { getLatestSnapshot } from "@/app/actions/sync"
import { isOpenWeight } from "@/lib/aa/filter"
import {
  GUIDE_MODEL_ID,
  buildGuidePrompt,
  buildHardwareContext,
  hasUsableHubDetail,
  readGuide,
  readGuideIndex,
  writeGuide,
} from "@/lib/aa/guide"
import { requireSyncPassword } from "@/lib/aa/protect"
import { unwrapMarkdown } from "@/lib/aa/report"
import { planServing } from "@/lib/aa/sizing"
import type { ModelGuide } from "@/lib/aa/types"
import { parseLocale } from "@/lib/i18n/locales"
import { getRequestLocale } from "@/lib/i18n/server"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const locale = parseLocale(params.get("locale")) ?? (await getRequestLocale())
  const modelId = params.get("modelId")
  const index = await readGuideIndex(locale)
  const guide = modelId ? await readGuide(locale, modelId) : null
  return Response.json({ index, guide }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ ok: false, error: "LLM_KEY_MISSING" }, { status: 503 })
  }

  let body: { password?: unknown; modelId?: unknown; locale?: unknown }
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

  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : ""
  if (!modelId) {
    return Response.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 })
  }

  const [snapshot, hub] = await Promise.all([getLatestSnapshot(), getLatestHubSnapshot()])
  if (!snapshot || snapshot.models.length === 0) {
    return Response.json({ ok: false, error: "NO_SNAPSHOT" }, { status: 400 })
  }

  const model = snapshot.models.find((row) => row.id === modelId)
  if (!model) {
    return Response.json({ ok: false, error: "MODEL_NOT_FOUND" }, { status: 400 })
  }
  if (!isOpenWeight(model)) {
    return Response.json({ ok: false, error: "NOT_OPEN" }, { status: 400 })
  }

  const detail = hub?.models[modelId]
  if (!hasUsableHubDetail(detail) || !detail) {
    return Response.json({ ok: false, error: "HUB_DETAIL_MISSING" }, { status: 400 })
  }

  const locale = parseLocale(typeof body.locale === "string" ? body.locale : "") ?? (await getRequestLocale())
  const hardwareContext = buildHardwareContext(model, detail)
  const sizing = planServing(hardwareContext)
  const { system, prompt } = buildGuidePrompt({ context: hardwareContext, locale, sizing })

  try {
    const result = await generateText({
      model: google(GUIDE_MODEL_ID),
      system,
      prompt,
      abortSignal: req.signal,
    })

    const guide: ModelGuide = {
      generatedAt: new Date().toISOString(),
      locale,
      modelId: model.id,
      modelName: model.name,
      hfId: detail.hfId,
      markdown: unwrapMarkdown(result.text),
      hardwareContext,
      geminiModel: GUIDE_MODEL_ID,
      sizing,
    }

    await writeGuide(guide)
    return Response.json({ ok: true, guide })
  } catch (error) {
    console.error("Guide generation failed:", error)
    return Response.json({ ok: false, error: "GENERATION_FAILED" }, { status: 500 })
  }
}
