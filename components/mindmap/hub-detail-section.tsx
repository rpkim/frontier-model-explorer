"use client"

import { useState, type ReactNode } from "react"
import { CopyIcon, ExternalLinkIcon, HardDriveIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { HubRefreshButton } from "@/components/explorer/hub-refresh-button"
import { ComputeGuideButton } from "@/components/guide/compute-guide-button"
import { formatBytesGb, formatGb, formatParams, timeAgo } from "@/lib/aa/format"
import { hasUsableHubDetail } from "@/lib/aa/guide"
import type { HubDetail } from "@/lib/aa/types"
import { useI18n } from "@/lib/i18n/provider"
import type { TFunction } from "@/lib/i18n/translate"

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-mono text-lg font-semibold tabular-nums leading-none">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function hubErrorMessage(error: string | undefined, t: TFunction): string | null {
  switch (error) {
    case "unmapped":
      return t("hub.unmapped")
    case "gated":
      return t("hub.errorGated")
    case "not_found":
      return t("hub.errorNotFound")
    case "timeout":
      return t("hub.errorTimeout")
    case "rate_limited":
      return t("hub.errorRateLimited")
    case "fetch_failed":
      return t("hub.errorFetch")
    default:
      return error ?? null
  }
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLinkIcon className="size-3" />
    </a>
  )
}

export function HubDetailSection({
  modelId,
  detail,
  hubFetchedAt,
}: {
  modelId: string
  detail: HubDetail | null
  hubFetchedAt: string | null
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const command = detail?.hfId ? `vllm serve ${detail.hfId}` : null

  async function copyCommand() {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      toast.success(t("hub.copied"))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("hub.failed"))
    }
  }

  if (!detail) {
    return (
      <section>
        <h3 className="mb-2.5 text-xs font-medium text-muted-foreground">{t("hub.sectionTitle")}</h3>
        <Empty className="border border-dashed border-border p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HardDriveIcon />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{t("hub.emptyTitle")}</EmptyTitle>
            <EmptyDescription className="text-xs">{t("hub.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row flex-wrap justify-center">
            <HubRefreshButton modelId={modelId} size="sm" />
            <HubRefreshButton variant="outline" size="sm" label={t("hub.refreshAll")} />
          </EmptyContent>
        </Empty>
      </section>
    )
  }

  const errorText = hubErrorMessage(detail.error, t)
  const otherDtypes = (detail.tensorDtypes ?? [])
    .map((row) => row.dtype)
    .filter((dtype) => dtype !== detail.primaryDtype)
  const uniqueOthers = [...new Set(otherDtypes)]
  const dtypeSub = uniqueOthers.length > 0 ? t("hub.tensorTypeMixed", { others: uniqueOthers.join(", ") }) : undefined
  const sizeSub =
    detail.modelSizeSource === "gguf"
      ? t("hub.modelSizeGguf")
      : detail.modelSizeSource === "usedStorage"
        ? t("hub.modelSizeRepo")
        : detail.modelSizeBytes != null
          ? t("hub.modelSizeSub")
          : undefined
  const nativeLabel = detail.vramEstimate?.nativeDtype
    ? t("hub.minGpuNative", { dtype: detail.vramEstimate.nativeDtype })
    : t("hub.minGpu")
  const hasQuant =
    detail.vramEstimate?.fp16 != null && detail.vramEstimate.int8 != null && detail.vramEstimate.int4 != null
  const hasMetrics =
    detail.parameterCount != null ||
    detail.modelSizeBytes != null ||
    detail.primaryDtype != null ||
    detail.license ||
    detail.gated != null ||
    detail.vramEstimate

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{t("hub.sectionTitle")}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <HubRefreshButton modelId={modelId} size="xs" />
          <HubRefreshButton variant="outline" size="xs" label={t("hub.refreshAll")} />
        </div>
      </div>

      {errorText && <p className="text-xs text-muted-foreground">{errorText}</p>}

      {hasMetrics && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label={t("hub.parameters")} value={formatParams(detail.parameterCount)} />
          {detail.modelSizeBytes != null && (
            <MetricCard label={t("hub.modelSize")} value={formatBytesGb(detail.modelSizeBytes)} sub={sizeSub} />
          )}
          {detail.primaryDtype && (
            <MetricCard label={t("hub.tensorType")} value={detail.primaryDtype} sub={dtypeSub} />
          )}
          <MetricCard
            label={t("hub.license")}
            value={detail.license ?? t("hub.unknownLicense")}
            sub={detail.gated ? t("hub.gatedYes") : detail.gated === false ? t("hub.gatedNo") : undefined}
          />
          {detail.pipelineTag && <MetricCard label={t("hub.pipelineTag")} value={detail.pipelineTag} />}
          {(detail.fetchedAt || hubFetchedAt) && (
            <MetricCard
              label={t("hub.lastFetched")}
              value={timeAgo(detail.fetchedAt || hubFetchedAt!, t)}
            />
          )}
        </div>
      )}

      {(detail.vramEstimate || hasMetrics) && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">{t("hub.minRequired")}</h4>
            <ComputeGuideButton modelId={modelId} disabled={!hasUsableHubDetail(detail)} />
          </div>
          {(detail.vramEstimate?.native != null || hasQuant) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {detail.vramEstimate?.native != null && (
                <MetricCard
                  label={nativeLabel}
                  value={formatGb(detail.vramEstimate.native)}
                  sub={
                    detail.vramEstimate.kvCache4k != null
                      ? t("hub.kvCacheLine", { size: formatGb(detail.vramEstimate.kvCache4k) })
                      : t("hub.minGpuSub")
                  }
                />
              )}
              {hasQuant && detail.vramEstimate && (
                <>
                  <MetricCard label={t("hub.fp16")} value={formatGb(detail.vramEstimate.fp16)} />
                  <MetricCard label={t("hub.int8")} value={formatGb(detail.vramEstimate.int8)} />
                  <MetricCard label={t("hub.int4")} value={formatGb(detail.vramEstimate.int4)} />
                </>
              )}
            </div>
          )}
          {detail.vramEstimate && (
            <p className="mt-2 text-xs text-muted-foreground">{t("hub.vramHint")}</p>
          )}
          {detail.modelSizeSource === "gguf" && (
            <p className="mt-1 text-xs text-muted-foreground">{t("hub.ggufRamHint")}</p>
          )}
        </div>
      )}

      {(detail.modelUrl || detail.officialUrl || detail.serving) && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">{t("hub.links")}</h4>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {detail.modelUrl && <OutLink href={detail.modelUrl}>{t("hub.hfCard")}</OutLink>}
            {detail.officialUrl && <OutLink href={detail.officialUrl}>{t("hub.official")}</OutLink>}
            {detail.serving?.vllm && <OutLink href={detail.serving.vllm}>{t("hub.vllm")}</OutLink>}
            {detail.serving?.sglang && <OutLink href={detail.serving.sglang}>{t("hub.sglang")}</OutLink>}
            {detail.serving?.ollama && <OutLink href={detail.serving.ollama}>{t("hub.ollama")}</OutLink>}
          </div>
        </div>
      )}

      {command && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">{t("hub.vllmCommand")}</h4>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{command}</code>
            <Button type="button" variant="ghost" size="xs" onClick={copyCommand}>
              <CopyIcon data-icon="inline-start" />
              {copied ? t("hub.copied") : t("hub.copyCommand")}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
