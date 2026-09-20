"use client"

import { ModelActions } from "@/components/explorer/model-actions"
import { formatPercent, formatScore, formatUsd } from "@/lib/aa/format"
import type { ModelValue, ValueAnalysis, WatchlistModel } from "@/lib/aa/value"
import { WORKLOAD_IDS, type WorkloadId } from "@/lib/aa/workloads"
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

export function DecisionBrief({ analysis }: { analysis: ValueAnalysis }) {
  const { t } = useI18n()
  const picks = analysis.workloads.filter((row) => row.bestValue)

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t("brief.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("brief.headline", {
            tasks: picks.length,
            priced: analysis.pricedModelCount,
            unpriced: analysis.unpricedModelCount,
          })}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg ring-1 ring-border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("brief.colTask")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("brief.colDo")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("brief.colDont")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("brief.colMonth")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {WORKLOAD_IDS.map((id) => {
              const workload = analysis.workloads.find((row) => row.workloadId === id)
              if (!workload?.bestValue) return null
              const avoid = workload.falseBargains[0] ?? workload.overpriced[0] ?? null
              return (
                <tr key={id} className="even:bg-muted/30">
                  <td className="px-3 py-2 align-top font-medium">{t(WORKLOAD_LABEL_KEYS[id])}</td>
                  <td className="px-3 py-2 align-top">
                    <PickCell value={workload.bestValue} />
                    {workload.premium &&
                      workload.premium.modelId !== workload.bestValue.modelId &&
                      workload.premiumCostMultiple != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("brief.premiumAside", {
                            multiple: workload.premiumCostMultiple,
                            gain: workload.premiumQualityGain ?? 0,
                            name: workload.premium.name,
                          })}
                        </p>
                      )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {avoid ? (
                      <div>
                        <p className="font-medium">{avoid.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {workload.falseBargains[0]
                            ? t("brief.avoidFalseBargain")
                            : t("brief.avoidOverpriced")}
                        </p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 align-top font-mono">
                    {formatUsd(workload.bestValue.monthlyCostUsd)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {analysis.substitutions && analysis.substitutions.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("brief.swapTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("brief.swapHint")}</p>
          <ul className="flex flex-col gap-2">
            {analysis.substitutions.map((row) => (
              <li key={`${row.workloadId}-${row.expensiveId ?? row.expensive}`} className="text-sm">
                <span className="text-muted-foreground">{t(WORKLOAD_LABEL_KEYS[row.workloadId])}: </span>
                {t("brief.swapLine", {
                  expensive: row.expensive,
                  alternative: row.alternative,
                  saved: row.savingsPercent,
                  delta: row.qualityDelta,
                })}
                {(row.expensiveId || row.alternativeId) && (
                  <span className="mt-0.5 flex flex-wrap gap-2">
                    {row.expensiveId && <ModelActions modelId={row.expensiveId} />}
                    {row.alternativeId && <ModelActions modelId={row.alternativeId} />}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.unpricedWatchlist && analysis.unpricedWatchlist.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("brief.watchlistTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("brief.watchlistHint")}</p>
          <ul className="flex flex-col gap-1">
            {analysis.unpricedWatchlist.map((row) => (
              <WatchlistRow key={row.modelId} row={row} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function PickCell({ value }: { value: ModelValue }) {
  const { t } = useI18n()
  return (
    <div>
      <p className="font-medium">{value.name}</p>
      <p className="text-xs text-muted-foreground">
        {t("brief.pickMeta", {
          quality: formatScore(value.quality),
          success: value.successRate != null ? formatPercent(value.successRate) : "—",
        })}
      </p>
      <ModelActions modelId={value.modelId} openWeight={value.openWeight} />
    </div>
  )
}

function WatchlistRow({ row }: { row: WatchlistModel }) {
  const { t } = useI18n()
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-0.5">
      <div className="min-w-0">
        <span className="text-sm font-medium">{row.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">{row.provider}</span>
        {row.intelligenceIndex != null && (
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {t("brief.intel", { score: formatScore(row.intelligenceIndex) })}
          </span>
        )}
      </div>
      <ModelActions modelId={row.modelId} openWeight={row.openWeight} />
    </li>
  )
}
