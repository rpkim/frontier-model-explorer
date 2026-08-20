"use client"

import { DatabaseIcon } from "lucide-react"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { SyncButton } from "@/components/explorer/sync-button"
import { useI18n } from "@/lib/i18n/provider"

export function SyncEmptyState() {
  const { t } = useI18n()

  return (
    <Empty className="min-h-[60vh] border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>
        <EmptyTitle>{t("sync.emptyTitle")}</EmptyTitle>
        <EmptyDescription>{t("sync.emptyDescription")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <SyncButton variant="default" />
      </EmptyContent>
    </Empty>
  )
}
