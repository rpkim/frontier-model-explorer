"use client"

import { useMemo } from "react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ScaleIcon } from "lucide-react"
import { useQueryState } from "@/hooks/use-query-state"
import type { ModelNode } from "@/lib/aa/types"
import { ModelPicker } from "@/components/compare/model-picker"
import { CompareTable } from "@/components/compare/compare-table"
import { ParetoScatter } from "@/components/charts/pareto-scatter"

const MAX_MODELS = 4

export function CompareExplorer({ models }: { models: ModelNode[] }) {
  const { get, set } = useQueryState()

  const selectedIds = useMemo(() => {
    const raw = get("models")
    return raw ? raw.split(",").filter(Boolean) : []
  }, [get])

  const selectedModels = selectedIds
    .map((id) => models.find((m) => m.id === id))
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
          최대 {MAX_MODELS}개까지 비교할 수 있습니다 (<span className="font-mono">{selectedIds.length}</span>/
          {MAX_MODELS})
        </span>
      </div>

      {selectedModels.length === 0 ? (
        <Empty className="min-h-[40vh] border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScaleIcon />
            </EmptyMedia>
            <EmptyTitle>비교할 모델을 추가하세요</EmptyTitle>
            <EmptyDescription>
              위의 &quot;모델 추가&quot; 버튼으로 2개 이상의 모델을 선택하면 벤치마크, 가격, 속도를 나란히 비교할 수
              있습니다.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="rounded-lg border border-border">
            <CompareTable models={selectedModels} onRemove={removeModel} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Pareto · 지능 대비 가격</h3>
              <ParetoScatter models={models} xMetric="price" highlightIds={selectedIds} />
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Pareto · 지능 대비 속도</h3>
              <ParetoScatter models={models} xMetric="speed" highlightIds={selectedIds} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
