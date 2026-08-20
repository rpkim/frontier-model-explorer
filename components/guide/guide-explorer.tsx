"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileTextIcon, InfoIcon, Loader2Icon, RefreshCwIcon, ServerCogIcon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { PasswordDialog } from "@/components/explorer/password-dialog"
import { ReportMarkdown } from "@/components/report/report-markdown"
import { useQueryState } from "@/hooks/use-query-state"
import { formatDate, timeAgo } from "@/lib/aa/format"
import { downloadMarkdownFile } from "@/lib/aa/report-download"
import type { GuideIndex, ModelGuide } from "@/lib/aa/types"
import { LOCALE_META, parseLocale } from "@/lib/i18n/locales"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

function errorMessage(error: string | undefined, t: ReturnType<typeof useI18n>["t"]): string {
  switch (error) {
    case "LLM_KEY_MISSING":
      return t("guide.errorMissingKey", { env: "GOOGLE_GENERATIVE_AI_API_KEY" })
    case "NO_SNAPSHOT":
      return t("guide.errorNoSnapshot")
    case "HUB_DETAIL_MISSING":
      return t("guide.errorHubMissing")
    case "NOT_OPEN":
      return t("guide.errorNotOpen")
    case "MODEL_NOT_FOUND":
      return t("hub.modelNotFound")
    case "INVALID_SYNC_PASSWORD":
      return t("sync.invalidPassword")
    case "SYNC_PASSWORD_NOT_CONFIGURED":
      return t("sync.passwordNotConfigured")
    default:
      return t("guide.errorGeneric")
  }
}

function downloadBasename(guide: ModelGuide): string {
  const date = new Date(guide.generatedAt)
  const ymd = Number.isNaN(date.getTime()) ? "unknown-date" : date.toISOString().slice(0, 10)
  const slug = (guide.hfId ?? guide.modelId).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80)
  return `frontier-guide-${slug || "model"}-${ymd}`
}

export function GuideExplorer() {
  const { t, locale } = useI18n()
  const { get, set } = useQueryState()
  const selectedId = get("guideModel")
  const tab = get("tab")

  const [index, setIndex] = useState<GuideIndex>({})
  const [guide, setGuide] = useState<ModelGuide | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [generating, setGenerating] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const entries = useMemo(() => {
    return Object.entries(index).sort((a, b) => b[1].generatedAt.localeCompare(a[1].generatedAt))
  }, [index])

  const load = useCallback(async (modelId: string | null, signal?: AbortSignal) => {
    setLoadState("loading")
    try {
      const url = modelId ? `/api/guide?modelId=${encodeURIComponent(modelId)}` : "/api/guide"
      const response = await fetch(url, { signal, cache: "no-store" })
      if (!response.ok) throw new Error("load failed")
      const body = (await response.json()) as { index?: GuideIndex; guide?: ModelGuide | null }
      if (signal?.aborted) return
      setIndex(body.index ?? {})
      setGuide(body.guide ?? null)
      setLoadState("ready")
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) return
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(selectedId, controller.signal)
    return () => controller.abort()
  }, [load, selectedId])

  useEffect(() => {
    if (tab !== "guides") return
    if (loadState !== "ready" || selectedId || entries.length === 0) return
    set({ guideModel: entries[0][0] })
  }, [entries, loadState, selectedId, set, tab])

  async function regenerate(password: string) {
    if (!selectedId) return
    setGenerating(true)
    try {
      const response = await fetch("/api/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, modelId: selectedId, locale }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string; guide?: ModelGuide }
      if (!response.ok || !body.ok || !body.guide) {
        toast.error(errorMessage(body.error, t))
        return
      }
      setGuide(body.guide)
      setIndex((prev) => ({
        ...prev,
        [body.guide!.modelId]: {
          generatedAt: body.guide!.generatedAt,
          modelName: body.guide!.modelName,
          hfId: body.guide!.hfId,
        },
      }))
      setLoadState("ready")
    } catch {
      toast.error(t("guide.errorGeneric"))
    } finally {
      setGenerating(false)
    }
  }

  function downloadMarkdown() {
    if (!guide) return
    try {
      downloadMarkdownFile(guide.markdown, guide.generatedAt, downloadBasename(guide))
    } catch {
      toast.error(t("guide.downloadError"))
    }
  }

  const guideLocale = guide ? parseLocale(guide.locale) : null
  const localeMismatch = Boolean(guide && guideLocale && guideLocale !== locale)
  const guideLocaleName = guideLocale ? LOCALE_META[guideLocale].nativeName : guide?.locale

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="border-b border-border lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="px-4 py-3 sm:px-5">
          <p className="text-xs font-medium text-muted-foreground">{t("guide.listTitle")}</p>
        </div>
        {loadState === "loading" && entries.length === 0 ? (
          <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-muted-foreground sm:px-5">{t("guide.emptyList")}</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto px-2 pb-3 lg:max-h-none">
            {entries.map(([id, entry]) => {
              const active = id === selectedId
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => set({ guideModel: id })}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left",
                      active ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="block truncate text-sm font-medium">{entry.modelName}</span>
                    <span className="block truncate font-mono text-[0.65rem] text-muted-foreground">
                      {timeAgo(entry.generatedAt, t)}
                      {entry.hfId ? ` · ${entry.hfId}` : ""}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        {generating ? (
          <GeneratingState />
        ) : loadState === "error" ? (
          <Empty className="min-h-[40vh] border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerCogIcon />
              </EmptyMedia>
              <EmptyTitle>{t("guide.loadError")}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => void load(selectedId)}>
                {t("guide.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : loadState === "loading" && !guide ? (
          <LoadingState />
        ) : !guide ? (
          <Empty className="min-h-[40vh] border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ServerCogIcon />
              </EmptyMedia>
              <EmptyTitle>
                {entries.length > 0 ? t("guide.noSelectionTitle") : t("guide.emptyTitle")}
              </EmptyTitle>
              <EmptyDescription>
                {entries.length > 0 ? t("guide.noSelectionDescription") : t("guide.emptyDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">{guide.modelName}</p>
                <p className="text-xs text-muted-foreground">
                  {t("guide.generatedAt")}{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(guide.generatedAt, locale, t("format.unknownDate"))}
                  </span>
                  <span className="font-mono"> · {timeAgo(guide.generatedAt, t)}</span>
                </p>
                <p className="font-mono text-[0.7rem] text-muted-foreground">
                  {guide.geminiModel}
                  {guide.hfId ? ` · ${guide.hfId}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                  <FileTextIcon data-icon="inline-start" />
                  {t("guide.downloadMarkdown")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
                  <RefreshCwIcon data-icon="inline-start" />
                  {t("guide.regenerate")}
                </Button>
              </div>
            </div>

            {localeMismatch && (
              <Alert>
                <InfoIcon />
                <AlertDescription>
                  {t("guide.localeMismatch", { locale: guideLocaleName ?? guide.locale })}
                </AlertDescription>
              </Alert>
            )}

            <ReportMarkdown text={guide.markdown} />
          </>
        )}
      </div>

      <PasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        pending={generating}
        onSubmit={(password) => void regenerate(password)}
        title={t("guide.passwordTitle")}
        description={t("guide.passwordDescription")}
      />
    </div>
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
        <p className="text-sm font-medium">{t("guide.generating")}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("guide.generatingHint")}</p>
      </div>
      <div className="mt-4 flex w-full max-w-md flex-col gap-2" aria-hidden>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}
