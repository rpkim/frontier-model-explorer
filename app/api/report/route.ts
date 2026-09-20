import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { getLatestSnapshot } from "@/app/actions/sync"
import { requireSyncPassword } from "@/lib/aa/protect"
import {
  buildReportBaseline,
  diffAgainstBaseline,
  readReportBaseline,
  writeReportBaseline,
} from "@/lib/aa/changelog"
import { auditReportFigures } from "@/lib/aa/figure-audit"
import {
  REPORT_MODEL_ID,
  buildReportPrompt,
  readReport,
  unwrapMarkdown,
  writeReport,
} from "@/lib/aa/report"
import type { CatalogReport } from "@/lib/aa/types"
import { analyzeValue } from "@/lib/aa/value"
import { parseLocale } from "@/lib/i18n/locales"
import { getRequestLocale } from "@/lib/i18n/server"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const requested = parseLocale(new URL(req.url).searchParams.get("locale") ?? "")
  const locale = requested ?? (await getRequestLocale())
  const report = await readReport(locale)
  return Response.json({ report }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ ok: false, error: "LLM_KEY_MISSING" }, { status: 503 })
  }

  let body: { password?: unknown; locale?: unknown }
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

  const snapshot = await getLatestSnapshot()
  if (!snapshot || snapshot.models.length === 0) {
    return Response.json({ ok: false, error: "NO_SNAPSHOT" }, { status: 400 })
  }

  const locale = parseLocale(typeof body.locale === "string" ? body.locale : "") ?? (await getRequestLocale())
  const valueAnalysis = analyzeValue(snapshot.models)
  const baseline = await readReportBaseline()
  const changelog = baseline
    ? diffAgainstBaseline({ baseline, models: snapshot.models, analysis: valueAnalysis })
    : null
  const { system, prompt, catalogRows, summary } = buildReportPrompt({
    models: snapshot.models,
    syncedAt: snapshot.syncedAt,
    locale,
    changelog,
    valueAnalysis,
  })

  try {
    const result = await generateText({
      model: google(REPORT_MODEL_ID),
      system,
      prompt,
      abortSignal: req.signal,
    })

    const markdown = unwrapMarkdown(result.text)
    const generatedAt = new Date().toISOString()
    const figureAudit = auditReportFigures(markdown, [summary, valueAnalysis, changelog, catalogRows])
    const report: CatalogReport = {
      generatedAt,
      locale,
      markdown,
      modelCount: snapshot.models.length,
      model: REPORT_MODEL_ID,
      snapshotSyncedAt: snapshot.syncedAt,
      valueAnalysis,
      changelog,
      figureAudit,
    }

    await writeReport(report)
    await writeReportBaseline(
      buildReportBaseline({
        models: snapshot.models,
        analysis: valueAnalysis,
        generatedAt,
        snapshotSyncedAt: snapshot.syncedAt,
      }),
    )
    return Response.json({ ok: true, report })
  } catch (error) {
    console.error("Report generation failed:", error)
    return Response.json({ ok: false, error: "GENERATION_FAILED" }, { status: 500 })
  }
}
