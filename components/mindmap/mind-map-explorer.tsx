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
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { MousePointerClickIcon, LayersIcon, BrainCircuitIcon, ChevronLeftIcon, FunnelIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useQueryState } from "@/hooks/use-query-state"
import { groupModels, type GroupByKey } from "@/lib/aa/group-by"
import { DEFAULT_SORT, VALID_SORTS, sortGroupsByTopModel, sortModels, type SortKey } from "@/lib/aa/sort"
import { EMPTY_FILTERS, serializeCatalogFilters } from "@/lib/aa/filter"
import { colorForKey } from "@/lib/aa/colors"
import type { HubSnapshot, ModelNode } from "@/lib/aa/types"
import { useI18n } from "@/lib/i18n/provider"
import { GroupBySelector } from "@/components/mindmap/group-by-selector"
import { SortSelector } from "@/components/mindmap/sort-selector"
import { GroupColumn } from "@/components/mindmap/group-column"
import { ModelColumn } from "@/components/mindmap/model-column"
import { Connector } from "@/components/mindmap/connector"
import { ModelDetailPanel } from "@/components/mindmap/model-detail-panel"

const VALID_GROUP_BY: GroupByKey[] = ["provider", "intelligence", "price", "speed", "release"]

export function MindMapExplorer({
  models,
  hub,
  onAddToCompare,
}: {
  models: ModelNode[]
  hub: HubSnapshot | null
  onAddToCompare: (id: string) => void
}) {
  const { get, set } = useQueryState()
  const { t } = useI18n()

  const groupBy: GroupByKey = VALID_GROUP_BY.includes(get("by") as GroupByKey) ? (get("by") as GroupByKey) : "provider"
  const sort: SortKey = VALID_SORTS.includes(get("sort") as SortKey) ? (get("sort") as SortKey) : DEFAULT_SORT
  const groupId = get("group")
  const modelId = get("model")

  const groups = useMemo(() => {
    const grouped = groupModels(groupBy, models).map((group) => ({
      ...group,
      models: sortModels(group.models, sort),
    }))
    return groupBy === "provider" ? sortGroupsByTopModel(grouped, sort) : grouped
  }, [groupBy, models, sort])

  const selectedGroup = groups.find((g) => g.id === groupId) ?? null
  const selectedModel = selectedGroup?.models.find((m) => m.id === modelId) ?? null

  function handleGroupByChange(next: GroupByKey) {
    const nextGroups = groupModels(next, models)
    const owner = modelId ? nextGroups.find((g) => g.models.some((m) => m.id === modelId)) : undefined
    set({ by: next, group: owner?.id ?? null, model: owner ? modelId : null })
  }

  function handleClearFilters() {
    set(serializeCatalogFilters(EMPTY_FILTERS))
  }

  function handleSortChange(next: SortKey) {
    set({ sort: next === DEFAULT_SORT ? null : next })
  }

  function handleSelectGroup(id: string) {
    set({ group: id, model: null })
  }

  function handleSelectModel(id: string) {
    set({ model: id })
  }

  const groupColor = selectedGroup ? colorForKey(selectedGroup.id) : undefined
  const modelColor = selectedModel ? colorForKey(selectedModel.provider.slug) : undefined

  const mobileStep: "groups" | "models" | "detail" = selectedModel ? "detail" : selectedGroup ? "models" : "groups"

  function handleBack() {
    if (mobileStep === "detail") {
      set({ model: null })
    } else if (mobileStep === "models") {
      set({ group: null, model: null })
    }
  }

  const selectedGroupLabel = selectedGroup
    ? selectedGroup.labelKey
      ? t(selectedGroup.labelKey)
      : selectedGroup.label
    : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {mobileStep !== "groups" && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 sm:hidden">
          <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2 gap-1 text-muted-foreground">
            <ChevronLeftIcon className="size-4" />
            {t("nav.back")}
          </Button>
          <span className="truncate text-sm font-medium">
            {mobileStep === "detail" ? selectedModel?.name : selectedGroupLabel}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <GroupBySelector value={groupBy} onChange={handleGroupByChange} />
        <SortSelector value={sort} onChange={handleSortChange} />
      </div>
      <div className="hidden px-4 pb-3 sm:block sm:px-6 sm:pb-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#" onClick={(e) => e.preventDefault()} className="flex items-center gap-1.5">
                <BrainCircuitIcon className="size-3.5" />
                {t("nav.frontierModels")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {selectedGroup && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {selectedModel ? (
                    <BreadcrumbLink href="#" onClick={(e) => e.preventDefault()}>
                      {selectedGroupLabel}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{selectedGroupLabel}</BreadcrumbPage>
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
      <div className="flex min-h-0 flex-1 overflow-x-auto border-t border-border">
        {models.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4">
            <Empty className="border-0 p-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FunnelIcon />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{t("filter.emptyTitle")}</EmptyTitle>
                <EmptyDescription className="text-xs">{t("filter.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                {t("filter.clear")}
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 px-2 py-3 sm:px-4">
          <div
            className={cn(
              mobileStep === "groups" ? "flex" : "hidden",
              "min-w-0 flex-1 sm:flex sm:w-auto sm:flex-none",
            )}
          >
            <GroupColumn groups={groups} selectedId={groupId} onSelect={handleSelectGroup} />
          </div>

          <div className="hidden sm:flex">
            <Connector active={!!selectedGroup} color={groupColor} />
          </div>

          <div
            className={cn(
              mobileStep === "models" ? "flex" : "hidden",
              "min-w-0 flex-1 sm:flex sm:w-auto sm:flex-none",
            )}
          >
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
                    <EmptyTitle className="text-sm">{t("empty.selectGroup")}</EmptyTitle>
                    <EmptyDescription className="text-xs">{t("empty.selectGroupHint")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </div>

          <div className="hidden sm:flex">
            <Connector active={!!selectedModel} color={modelColor} />
          </div>

          <div className={cn(mobileStep === "detail" ? "flex min-w-0 flex-1" : "hidden", "sm:flex sm:flex-1")}>
            {selectedModel ? (
              <ModelDetailPanel model={selectedModel} allModels={models} hub={hub} onAddToCompare={onAddToCompare} />
            ) : (
              <div className="flex min-w-80 flex-1 items-center justify-center">
                <Empty className="border-0 p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MousePointerClickIcon />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">{t("empty.selectModel")}</EmptyTitle>
                    <EmptyDescription className="text-xs">{t("empty.selectModelHint")}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
