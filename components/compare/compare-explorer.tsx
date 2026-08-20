"use client"

import { useMemo } from "react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { FunnelIcon, ScaleIcon } from "lucide-react"
import { useQueryState } from "@/hooks/use-query-state"
import { EMPTY_FILTERS, serializeCatalogFilters } from "@/lib/aa/filter"
import type { ModelNode } from "@/lib/aa/types"
import { ModelPicker } from "@/components/compare/model-picker"
import { CompareTable } from "@/components/compare/compare-table"
import { ParetoScatter } from "@/components/charts/pareto-scatter"
import { useI18n } from "@/lib/i18n/provider"

const MAX_MODELS = 4

export function CompareExplorer({
  models,
  catalog,
}: {
  models: ModelNode[]
  catalog: ModelNode[]
}) {
  const { get, set } = useQueryState()
  const { t } = useI18n()

  const selectedIds = useMemo(() => {
    const raw = get("models")
    return raw ? raw.split(",").filter(Boolean) : []
  }, [get])

  const chartModels = useMemo(() => {
    const ids = new Set(models.map((model) => model.id))
    const extras = selectedIds
      .map((id) => catalog.find((model) => model.id === id))
      .filter((model): model is ModelNode => !!model && !ids.has(model.id))
    return extras.length > 0 ? [...models, ...extras] : models
  }, [catalog, models, selectedIds])

  const selectedModels = selectedIds
    .map((id) => catalog.find((m) => m.id === id))
    .filter((m): m is ModelNode => !!m)

  function addModel(id: string) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_MODELS) return
    set({ models: [...selectedIds, id].join(",") })
  }

  function removeModel(id: string) {
    const next = selectedIds.filter((existing) => existing !== id)
    set({ models: next.length > 0 ? next.join(",") : null })
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <ModelPicker
          models={models}
          excludeIds={selectedIds}
          onSelect={addModel}
          disabled={selectedIds.length >= MAX_MODELS}
        />
        <span className="text-xs text-muted-foreground">
          {t("compare.maxHint", { max: MAX_MODELS, current: selectedIds.length })}
        </span>
      </div>

      {models.length === 0 && selectedModels.length === 0 ? (
        <Empty className="min-h-[40vh] border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FunnelIcon />
            </EmptyMedia>
            <EmptyTitle>{t("filter.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("filter.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={() => set(serializeCatalogFilters(EMPTY_FILTERS))}>
            {t("filter.clear")}
          </Button>
        </Empty>
      ) : selectedModels.length === 0 ? (
        <Empty className="min-h-[40vh] border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScaleIcon />
            </EmptyMedia>
            <EmptyTitle>{t("compare.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("compare.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <CompareTable models={selectedModels} onRemove={removeModel} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">{t("compare.paretoPrice")}</h3>
              <ParetoScatter models={chartModels} xMetric="price" highlightIds={selectedIds} />
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">{t("compare.paretoSpeed")}</h3>
              <ParetoScatter models={chartModels} xMetric="speed" highlightIds={selectedIds} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
