"use client"

import { formatGb, formatUsd } from "@/lib/aa/format"
import { planServing, type ServingPlan, type SkuFit } from "@/lib/aa/sizing"
import type { GuideHardwareContext } from "@/lib/aa/types"
import { useI18n } from "@/lib/i18n/provider"

export function SizingPanel({
  sizing,
  hardware,
}: {
  sizing?: ServingPlan
  hardware: GuideHardwareContext
}) {
  const plan = sizing ?? planServing(hardware)
  const { t } = useI18n()

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t("sizing.title")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("sizing.subtitle", {
            weights: plan.weightHbmGb != null ? formatGb(plan.weightHbmGb) : "—",
            kv: plan.kvCache4kGb != null ? formatGb(plan.kvCache4kGb) : "—",
          })}
        </p>
        {plan.incomplete && <p className="text-xs text-muted-foreground">{t("sizing.incomplete")}</p>}
        {!plan.tpuJustified && <p className="text-xs text-muted-foreground">{t("sizing.tpuSkip")}</p>}
        <p className="text-xs text-muted-foreground">{t("sizing.priceCaveat")}</p>
      </div>

      <div className="overflow-x-auto rounded-lg ring-1 ring-border">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t("sizing.colTarget")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("sizing.colNeed")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("sizing.colGpu")}</th>
              <th className="px-3 py-2 text-left font-medium">{t("sizing.colMonth")}</th>
              {plan.tpuJustified && (
                <th className="px-3 py-2 text-left font-medium">{t("sizing.colTpu")}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plan.targets.map((target) => (
              <tr key={target.id} className="even:bg-muted/30">
                <td className="px-3 py-2 align-top">
                  <div className="font-medium">
                    {target.id === "budget" ? t("sizing.budget") : t("sizing.production")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("sizing.workload", {
                      context: target.contextTokens.toLocaleString("en-US"),
                      batch: target.batch,
                    })}
                  </div>
                </td>
                <td className="px-3 py-2 align-top font-mono">
                  {target.requiredHbmGb > 0 ? formatGb(target.requiredHbmGb) : "—"}
                </td>
                <td className="px-3 py-2 align-top">
                  <SkuCell fit={target.gpu} />
                </td>
                <td className="px-3 py-2 align-top font-mono">
                  {formatUsd(target.gpu?.monthlyUsd ?? null)}
                </td>
                {plan.tpuJustified && (
                  <td className="px-3 py-2 align-top">
                    <SkuCell fit={target.tpu} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.targets.map((target) =>
        target.serveCommand ? (
          <div key={`${target.id}-cmd`} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {target.id === "budget" ? t("sizing.cmdBudget") : t("sizing.cmdProduction")}
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 font-mono text-[0.75rem] leading-snug ring-1 ring-border">
              {target.serveCommand}
            </pre>
          </div>
        ) : null,
      )}
    </section>
  )
}

function SkuCell({ fit }: { fit: SkuFit | null }) {
  const { t } = useI18n()
  if (!fit) return <span className="text-muted-foreground">{t("sizing.noFit")}</span>
  return (
    <div>
      <div className="font-medium">
        {fit.count}× {fit.label}
      </div>
      {fit.topology && <div className="text-xs text-muted-foreground">{fit.topology}</div>}
    </div>
  )
}
