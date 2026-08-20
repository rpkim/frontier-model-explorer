"use client"

import { useCallback, useEffect, useState } from "react"
import {
  DownloadIcon,
  FileBarChartIcon,
  FileTextIcon,
  InfoIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordDialog } from "@/components/explorer/password-dialog"
import { exportReportPdf } from "@/components/report/export-report-pdf"
import { ReportMarkdown } from "@/components/report/report-markdown"
import { useQueryState } from "@/hooks/use-query-state"
import { formatDate, timeAgo } from "@/lib/aa/format"
import { hasActiveFilters, parseCatalogFilters } from "@/lib/aa/filter"
import { downloadMarkdownFile, reportDownloadBasename } from "@/lib/aa/report-download"
import type { CatalogReport, ModelNode } from "@/lib/aa/types"
import { LOCALE_META, parseLocale } from "@/lib/i18n/locales"
import { useI18n } from "@/lib/i18n/provider"

function errorMessage(
  error: string | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  switch (error) {
    case "LLM_KEY_MISSING":
      return t("report.errorMissingKey", { env: "GOOGLE_GENERATIVE_AI_API_KEY" })
    case "NO_SNAPSHOT":
      return t("report.errorNoSnapshot")
    case "INVALID_SYNC_PASSWORD":
      return t("sync.invalidPassword")
    case "SYNC_PASSWORD_NOT_CONFIGURED":
      return t("sync.passwordNotConfigured")
    default:
      return t("report.errorGeneric")
  }
}

export function ReportExplorer({
  catalog,
  snapshotSyncedAt,
}: {
  catalog: ModelNode[]
  snapshotSyncedAt: string
}) {
  const { t, locale } = useI18n()
  const { get } = useQueryState()
  const filters = parseCatalogFilters(get)
  const filtersActive = hasActiveFilters(filters)

  const [report, setReport] = useState<CatalogReport | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [generating, setGenerating] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const loadReport = useCallback(async (signal?: AbortSignal) => {
    setLoadState("loading")
    try {
      const response = await fetch("/api/report", { signal, cache: "no-store" })
      if (!response.ok) throw new Error("load failed")
      const body = (await response.json()) as { report: CatalogReport | null }
      if (signal?.aborted) return
      setReport(body.report)
      setLoadState("ready")
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadReport(controller.signal)
    return () => controller.abort()
  }, [loadReport])

  async function generate(password: string) {
    setGenerating(true)
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string; report?: CatalogReport }
      if (!response.ok || !body.ok || !body.report) {
        toast.error(errorMessage(body.error, t))
        return
      }
      setReport(body.report)
      setLoadState("ready")
    } catch {
      toast.error(t("report.errorGeneric"))
    } finally {
      setGenerating(false)
    }
  }

  function downloadMarkdown() {
    if (!report) return
    try {
      downloadMarkdownFile(report.markdown, report.generatedAt)
    } catch {
      toast.error(t("report.downloadError"))
    }
  }

  async function downloadPdf() {
    if (!report || downloadingPdf) return
    setDownloadingPdf(true)
    try {
      await exportReportPdf({
        markdown: report.markdown,
        title: t("app.title"),
        meta: `${formatDate(report.generatedAt, locale, t("format.unknownDate"))} · ${t("report.modelCount", { count: report.modelCount })}`,
        model: report.model,
        filename: `${reportDownloadBasename(report.generatedAt)}.pdf`,
      })
    } catch {
      toast.error(t("report.downloadError"))
    } finally {
      setDownloadingPdf(false)
    }
  }

  const stale = Boolean(report && report.snapshotSyncedAt !== snapshotSyncedAt)
  const reportLocale = report ? parseLocale(report.locale) : null
  const localeMismatch = Boolean(report && reportLocale && reportLocale !== locale)
  const reportLocaleName = reportLocale ? LOCALE_META[reportLocale].nativeName : report?.locale

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
        {filtersActive && !generating && (
          <Alert>
            <InfoIcon />
            <AlertDescription>{t("report.filtersIgnored", { count: catalog.length })}</AlertDescription>
          </Alert>
        )}

        {generating ? (
          <GeneratingState />
        ) : loadState === "loading" ? (
          <LoadingState />
        ) : loadState === "error" ? (
          <Empty className="min-h-[40vh] border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileBarChartIcon />
              </EmptyMedia>
              <EmptyTitle>{t("report.loadError")}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => void loadReport()}>
                {t("report.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : !report ? (
          <Empty className="min-h-[40vh] border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileBarChartIcon />
              </EmptyMedia>
              <EmptyTitle>{t("report.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("report.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={() => setPasswordOpen(true)}>
                  <SparklesIcon data-icon="inline-start" />
                  {t("report.generate")}
                </Button>
                <DownloadButtons
                  disabled
                  downloadingPdf={false}
                  onMarkdown={downloadMarkdown}
                  onPdf={() => void downloadPdf()}
                />
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t("report.generatedAt")}{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(report.generatedAt, locale, t("format.unknownDate"))}
                  </span>
                  <span className="font-mono"> · {timeAgo(report.generatedAt, t)}</span>
                  <span>
                    {" "}
                    · {t("report.modelCount", { count: report.modelCount })}
                  </span>
                </p>
                <p className="font-mono text-[0.7rem] text-muted-foreground">{report.model}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DownloadButtons
                  disabled={false}
                  downloadingPdf={downloadingPdf}
                  onMarkdown={downloadMarkdown}
                  onPdf={() => void downloadPdf()}
                />
                <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
                  <RefreshCwIcon data-icon="inline-start" />
                  {t("report.regenerate")}
                </Button>
              </div>
            </div>

            {(stale || localeMismatch) && (
              <div className="grid gap-2">
                {stale && (
                  <Alert>
                    <InfoIcon />
                    <AlertDescription>{t("report.staleHint")}</AlertDescription>
                  </Alert>
                )}
                {localeMismatch && (
                  <Alert>
                    <InfoIcon />
                    <AlertDescription>
                      {t("report.localeMismatch", { locale: reportLocaleName ?? report.locale })}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <ReportMarkdown text={report.markdown} />
          </>
        )}
      </div>

      <PasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        pending={generating}
        onSubmit={(password) => void generate(password)}
      />
    </div>
  )
}

function DownloadButtons({
  disabled,
  downloadingPdf,
  onMarkdown,
  onPdf,
}: {
  disabled: boolean
  downloadingPdf: boolean
  onMarkdown: () => void
  onPdf: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onMarkdown}>
        <FileTextIcon data-icon="inline-start" />
        {t("report.downloadMarkdown")}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled || downloadingPdf} onClick={onPdf}>
        {downloadingPdf ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        {downloadingPdf ? t("report.downloadingPdf") : t("report.downloadPdf")}
      </Button>
    </>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 pt-2" aria-hidden>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-4 h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function GeneratingState() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{t("report.generating")}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("report.generatingHint")}</p>
      </div>
      <div className="mt-4 flex w-full max-w-md flex-col gap-2" aria-hidden>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
