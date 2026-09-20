"use client"

import { formatDate, formatUsd } from "@/lib/aa/format"
import type { CatalogChangelog } from "@/lib/aa/changelog"
import { type WorkloadId } from "@/lib/aa/workloads"
import { useI18n } from "@/lib/i18n/provider"
import type { MessageKey } from "@/lib/i18n/translate"

const WORKLOAD_LABEL_KEYS: Record<WorkloadId, MessageKey> = {
  chat: "workload.chat",
  rag: "workload.rag",
  toolAgent: "workload.toolAgent",
  codingAgent: "workload.codingAgent",
  reasoning: "workload.reasoning",
  bulkExtraction: "workload.bulkExtraction",
}

export function ChangelogPanel({
  changelog,
  locale,
}: {
  changelog: CatalogChangelog
  locale: Parameters<typeof formatDate>[1]
}) {
  const { t } = useI18n()

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t("changelog.title")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("changelog.since", {
            date: formatDate(changelog.previousSnapshotSyncedAt, locale, t("format.unknownDate")),
          })}
        </p>
      </div>

      {changelog.newModelCount > 0 && (
        <ChangeGroup
          title={t("changelog.newModels", { count: changelog.newModelCount })}
          items={changelog.newModels.map((row) => `${row.name} · ${row.provider}`)}
        />
      )}
      {changelog.retiredModelCount > 0 && (
        <ChangeGroup
          title={t("changelog.retiredModels", { count: changelog.retiredModelCount })}
          items={changelog.retiredModels.map((row) => `${row.name} · ${row.provider}`)}
        />
      )}
      {changelog.priceChangeCount > 0 && (
        <ChangeGroup
          title={t("changelog.priceMoves", { count: changelog.priceChangeCount })}
          items={changelog.priceChanges.map((row) => {
            const sign = row.changePercent > 0 ? "+" : ""
            return t("changelog.priceMove", {
              name: row.name,
              side: row.side === "input" ? t("changelog.sideInput") : t("changelog.sideOutput"),
              percent: `${sign}${row.changePercent}`,
              from: formatUsd(row.fromUsdPerM),
              to: formatUsd(row.toUsdPerM),
            })
          })}
        />
      )}
      {changelog.workloadShifts.length > 0 && (
        <ChangeGroup
          title={t("changelog.pickChanges")}
          items={changelog.workloadShifts.map((row) => {
            const task = t(WORKLOAD_LABEL_KEYS[row.workloadId])
            if (row.previousBestValue && row.bestValue && row.previousBestValue !== row.bestValue) {
              return t("changelog.pickChanged", {
                task,
                from: row.previousBestValue,
                to: row.bestValue,
              })
            }
            return t("changelog.frontierMoved", { task })
          })}
        />
      )}
    </section>
  )
}

function ChangeGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
