"use client"

import { BrainCircuitIcon } from "lucide-react"
import { SyncButton } from "@/components/explorer/sync-button"
import { HubRefreshButton } from "@/components/explorer/hub-refresh-button"
import { LanguageSwitcher } from "@/components/explorer/language-switcher"
import { timeAgo } from "@/lib/aa/format"
import { useI18n } from "@/lib/i18n/provider"

export function ExplorerHeader({
  syncedAt,
  hubFetchedAt,
  modelCount,
}: {
  syncedAt: string | null
  hubFetchedAt: string | null
  modelCount: number
}) {
  const { t } = useI18n()

  return (
    <header className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <BrainCircuitIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-balance text-lg font-semibold leading-tight tracking-tight">{t("app.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {modelCount > 0 ? t("app.modelCount", { count: modelCount }) : t("app.dataSource")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {(syncedAt || hubFetchedAt) && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {syncedAt && (
              <>
                {t("app.lastSynced")} <span className="font-mono">{timeAgo(syncedAt, t)}</span>
              </>
            )}
            {syncedAt && hubFetchedAt && <span className="mx-1.5 text-border">·</span>}
            {hubFetchedAt && (
              <>
                {t("app.lastHubDetails")} <span className="font-mono">{timeAgo(hubFetchedAt, t)}</span>
              </>
            )}
          </span>
        )}
        <LanguageSwitcher />
        <SyncButton />
        {modelCount > 0 && <HubRefreshButton />}
      </div>
    </header>
  )
}
