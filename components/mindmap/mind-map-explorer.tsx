"use client"

import { useMemo } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { MousePointerClickIcon, LayersIcon, BrainCircuitIcon } from "lucide-react"
import { useQueryState } from "@/hooks/use-query-state"
import { groupModels, type GroupByKey } from "@/lib/aa/group-by"
import { colorForKey } from "@/lib/aa/colors"
import type { ModelNode } from "@/lib/aa/types"
import { GroupBySelector } from "@/components/mindmap/group-by-selector"
import { GroupColumn } from "@/components/mindmap/group-column"
import { ModelColumn } from "@/components/mindmap/model-column"
import { Connector } from "@/components/mindmap/connector"
import { ModelDetailPanel } from "@/components/mindmap/model-detail-panel"

const VALID_GROUP_BY: GroupByKey[] = ["provider", "intelligence", "price", "speed", "release"]

export function MindMapExplorer({
  models,
  onAddToCompare,
}: {
  models: ModelNode[]
  onAddToCompare: (id: string) => void
}) {
  const { get, set } = useQueryState()

  const groupBy: GroupByKey = VALID_GROUP_BY.includes(get("by") as GroupByKey) ? (get("by") as GroupByKey) : "provider"
  const groupId = get("group")
  const modelId = get("model")

  const groups = useMemo(() => groupModels(groupBy, models), [groupBy, models])
  const selectedGroup = groups.find((g) => g.id === groupId) ?? null
  const selectedModel = selectedGroup?.models.find((m) => m.id === modelId) ?? null

  function handleGroupByChange(next: GroupByKey) {
    // Try to keep the currently selected model in view under the new axis;
    // only reset the selection if it has no home in the new grouping.
    const nextGroups = groupModels(next, models)
    const owner = modelId ? nextGroups.find((g) => g.models.some((m) => m.id === modelId)) : undefined
    set({ by: next, group: owner?.id ?? null, model: owner ? modelId : null })
  }

  function handleSelectGroup(id: string) {
    set({ group: id, model: null })
  }

  function handleSelectModel(id: string) {
    set({ model: id })
  }

  const groupColor = selectedGroup ? colorForKey(selectedGroup.id) : undefined
  const modelColor = selectedModel ? colorForKey(selectedModel.provider.slug) : undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <GroupBySelector value={groupBy} onChange={handleGroupByChange} />
        <div className="hidden px-4 pb-3 sm:block sm:px-6 sm:pb-0">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1.5">
                  <BrainCircuitIcon className="size-3.5" />
                  Frontier Models
                </BreadcrumbLink>
              </BreadcrumbItem>
              {selectedGroup && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {selectedModel ? (
                      <BreadcrumbLink href="#" onClick={(e) => e.preventDefault()}>
                        {selectedGroup.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{selectedGroup.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </>
              )}
              {selectedModel && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedModel.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-x-auto border-t border-border">
        <div className="flex min-h-0 flex-1 px-2 py-3 sm:px-4">
          <GroupColumn groups={groups} selectedId={groupId} onSelect={handleSelectGroup} />

          <Connector active={!!selectedGroup} color={groupColor} />

          {selectedGroup ? (
            <ModelColumn
              models={selectedGroup.models}
              groupBy={groupBy}
              selectedId={modelId}
              onSelect={handleSelectModel}
            />
          ) : (
            <div className="flex w-64 shrink-0 items-center justify-center sm:w-72">
              <Empty className="border-0 p-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LayersIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">그룹을 선택하세요</EmptyTitle>
                  <EmptyDescription className="text-xs">왼쪽에서 그룹을 클릭하면 모델 목록이 나옵니다.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}

          <Connector active={!!selectedModel} color={modelColor} />

          {selectedModel ? (
            <ModelDetailPanel model={selectedModel} allModels={models} onAddToCompare={onAddToCompare} />
          ) : (
            <div className="flex min-w-80 flex-1 items-center justify-center">
              <Empty className="border-0 p-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MousePointerClickIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">모델을 선택하세요</EmptyTitle>
                  <EmptyDescription className="text-xs">모델을 클릭하면 상세 메타데이터가 나옵니다.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
