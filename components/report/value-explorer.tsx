"use client"

import { useMemo, useState, type ReactNode } from "react"
import { AlertTriangleIcon, ClockIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ModelActions } from "@/components/explorer/model-actions"
import { formatPercent, formatScore, formatUsd } from "@/lib/aa/format"
import type { ModelValue, ValueAnalysis, WorkloadValueAnalysis } from "@/lib/aa/value"
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

const LATENCY_LABEL_KEYS: Record<WorkloadValueAnalysis["latencyClass"], MessageKey> = {
  interactive: "value.latencyInteractive",
  responsive: "value.latencyResponsive",
  batch: "value.latencyBatch",
}

interface Row {
  roles?: MessageKey[]
  value: ModelValue
}

/** One model often fills several roles at once; show it on a single row rather than repeating it. */
function mergeRoles(candidates: { role: MessageKey; value: ModelValue | null }[]): Row[] {
  const rows: Row[] = []
  for (const { role, value } of candidates) {
    if (!value) continue
    const existing = rows.find((row) => row.value.modelId === value.modelId)
    if (existing) existing.roles?.push(role)
    else rows.push({ roles: [role], value })
  }
  return rows
}

export function ValueExplorer({ analysis }: { analysis: ValueAnalysis }) {
  const { t } = useI18n()
  const [workloadId, setWorkloadId] = useState<WorkloadId>(WORKLOAD_IDS[0])

  const workload = useMemo(
    () => analysis.workloads.find((row) => row.workloadId === workloadId) ?? analysis.workloads[0],
    [analysis.workloads, workloadId],
  )

  const [volumeInput, setVolumeInput] = useState<string>("")

  if (!workload) return null

  const parsedVolume = Number.parseInt(volumeInput.replace(/[^\d]/g, ""), 10)
  const volume = Number.isFinite(parsedVolume) && parsedVolume > 0 ? parsedVolume : workload.monthlyTasks

  const picks = mergeRoles([
    { role: "value.roleBest", value: workload.bestValue },
    { role: "value.roleRunnerUp", value: workload.runnerUp },
    { role: "value.roleBudget", value: workload.budget },
    { role: "value.rolePremium", value: workload.premium },
  ])

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t("value.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("value.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-64">
          <span className="text-xs font-medium text-muted-foreground">{t("value.workload")}</span>
          <Select
            value={workloadId}
            onValueChange={(next) => {
              if (next) {
                setWorkloadId(next as WorkloadId)
                setVolumeInput("")
              }
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue>
                {(current: string | null) =>
                  current ? t(WORKLOAD_LABEL_KEYS[current as WorkloadId]) : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WORKLOAD_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {t(WORKLOAD_LABEL_KEYS[id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("value.monthlyTasks")}</span>
          <Input
            type="text"
            inputMode="numeric"
            className="h-8 w-36 font-mono text-sm"
            value={volumeInput}
            placeholder={workload.monthlyTasks.toLocaleString("en-US")}
            onChange={(event) => setVolumeInput(event.target.value)}
          />
        </label>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("value.assumption", {
          input: workload.inputTokensPerTask.toLocaleString("en-US"),
          output: workload.outputTokensPerTask.toLocaleString("en-US"),
          ratio: workload.tokenRatio,
          floor: workload.qualityFloor,
          topPercent: workload.qualityFloorTopPercent,
          latency: t(LATENCY_LABEL_KEYS[workload.latencyClass]),
          eligible: workload.eligibleCount,
          rated: workload.ratedCount,
        })}
        {workload.unmeasuredLatencyCount > 0 && (
          <> {t("value.excludedLatency", { count: workload.unmeasuredLatencyCount })}</>
        )}
      </p>

      {picks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("value.noEligible")}</p>
      ) : (
        <ValueTable rows={picks} volume={volume} showRole />
      )}

      {workload.premiumCostMultiple != null && workload.premiumQualityGain != null && workload.bestValue && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          {t("value.premiumNote", {
            multiple: workload.premiumCostMultiple,
            best: workload.bestValue.name,
            gain: workload.premiumQualityGain,
          })}
        </p>
      )}

      {workload.frontier.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold">{t("value.frontierTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("value.frontierHint")}</p>
          <ValueTable rows={workload.frontier.map((value) => ({ value }))} volume={volume} />
        </div>
      )}

      {(workload.falseBargains.length > 0 || workload.overpriced.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("value.trapsTitle")}</h3>
          <TrapList
            hint={t("value.falseBargainHint")}
            rows={workload.falseBargains}
            metric={(row) => formatUsd(row.costPerSuccessUsd)}
          />
          <TrapList
            hint={t("value.overpricedHint")}
            rows={workload.overpriced}
            metric={(row) => formatUsd(row.costPerTaskUsd)}
          />
        </div>
      )}
    </section>
  )
}

function ValueTable({
  rows,
  volume,
  showRole = false,
}: {
  rows: Row[]
  volume: number
  showRole?: boolean
}) {
  const { t } = useI18n()

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {showRole && <th className="px-3 py-2 text-left font-medium">{t("value.colRole")}</th>}
            <th className="px-3 py-2 text-left font-medium">{t("value.colModel")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("value.colQuality")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("value.colSuccess")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("value.colCostPerTask")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("value.colCostPerMonth")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ roles, value }) => (
            <tr key={value.modelId} className="even:bg-muted/30">
              {showRole && (
                <td className="px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                  {roles?.map((role) => t(role)).join(" · ")}
                </td>
              )}
              <td className="px-3 py-2 align-top">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{value.name}</span>
                  {value.openWeight && (
                    <Badge variant="outline" className="text-[0.65rem]">
                      {t("value.openWeight")}
                    </Badge>
                  )}
                  {value.latencyStatus === "unknown" && (
                    <Flag icon={<ClockIcon className="size-3" />} label={t("value.latencyUnknownNote")} />
                  )}
                  {value.coverage < 1 && (
                    <Flag
                      icon={<AlertTriangleIcon className="size-3" />}
                      label={t("value.coverageNote", { percent: Math.round(value.coverage * 100) })}
                    />
                  )}
                </div>
                    <div className="text-xs text-muted-foreground">{value.provider}</div>
                    <ModelActions modelId={value.modelId} openWeight={value.openWeight} />
              </td>
              <td className="px-3 py-2 align-top font-mono">{formatScore(value.quality)}</td>
              <td className="px-3 py-2 align-top font-mono">
                {value.successRate != null ? (
                  <Tooltip>
                    <TooltipTrigger className="cursor-default underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">
                      {formatPercent(value.successRate)}
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("value.successSignalNote", { benchmark: value.successSignal ?? "" })}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 align-top font-mono">{formatUsd(value.costPerTaskUsd)}</td>
              <td className="px-3 py-2 align-top font-mono">
                {formatUsd(value.costPerTaskUsd * volume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Flag({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="text-muted-foreground" aria-label={label}>
        {icon}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function TrapList({
  hint,
  rows,
  metric,
}: {
  hint: string
  rows: ModelValue[]
  metric: (row: ModelValue) => string
}) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{hint}</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((row) => (
          <li key={row.modelId} className="text-sm">
            <span className="font-medium">{row.name}</span>
            <span className="ml-1.5 font-mono text-xs text-muted-foreground">{metric(row)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
