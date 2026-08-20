"use client"

import { useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueryState } from "@/hooks/use-query-state"
import { filterModels, parseCatalogFilters } from "@/lib/aa/filter"
import type { HubSnapshot, ModelNode } from "@/lib/aa/types"
import { FilterBar } from "@/components/explorer/filter-bar"
import { MindMapExplorer } from "@/components/mindmap/mind-map-explorer"
import { CompareExplorer } from "@/components/compare/compare-explorer"
import { ReportExplorer } from "@/components/report/report-explorer"
import { GuideExplorer } from "@/components/guide/guide-explorer"
import { useI18n } from "@/lib/i18n/provider"

const MAX_COMPARE_MODELS = 4

type ExplorerTab = "mindmap" | "compare" | "report" | "guides"

function parseTab(raw: string | null): ExplorerTab {
  if (raw === "compare" || raw === "report" || raw === "guides") return raw
  return "mindmap"
}

export function ExplorerTabs({
  models,
  syncedAt,
  hub,
}: {
  models: ModelNode[]
  syncedAt: string
  hub: HubSnapshot | null
}) {
  const { get, set } = useQueryState()
  const { t } = useI18n()
  const tab = parseTab(get("tab"))
  const filters = useMemo(() => parseCatalogFilters(get), [get])
  const filteredModels = useMemo(() => filterModels(models, filters), [models, filters])

  function addToCompare(id: string) {
    const raw = get("models")
    const ids = raw ? raw.split(",").filter(Boolean) : []
    const nextIds = !ids.includes(id) && ids.length < MAX_COMPARE_MODELS ? [...ids, id] : ids
    set({ tab: "compare", models: nextIds.join(",") })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => set({ tab: next === "mindmap" ? null : next })}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="border-b border-border px-4 sm:px-6">
        <TabsList className="h-11 bg-transparent p-0">
          <TabsTrigger
            value="mindmap"
            className="rounded-none border-b-2 border-transparent bg-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t("tabs.mindmap")}
          </TabsTrigger>
          <TabsTrigger
            value="compare"
            className="rounded-none border-b-2 border-transparent bg-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t("tabs.compare")}
          </TabsTrigger>
          <TabsTrigger
            value="report"
            className="rounded-none border-b-2 border-transparent bg-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t("tabs.report")}
          </TabsTrigger>
          <TabsTrigger
            value="guides"
            className="rounded-none border-b-2 border-transparent bg-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            {t("tabs.guides")}
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <FilterBar catalog={models} filteredCount={filteredModels.length} />
      </div>
      <TabsContent value="mindmap" className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <MindMapExplorer models={filteredModels} hub={hub} onAddToCompare={addToCompare} />
      </TabsContent>
      <TabsContent value="compare" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
        <CompareExplorer models={filteredModels} catalog={models} />
      </TabsContent>
      <TabsContent value="report" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
        <ReportExplorer catalog={models} snapshotSyncedAt={syncedAt} />
      </TabsContent>
      <TabsContent value="guides" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
        <GuideExplorer />
      </TabsContent>
    </Tabs>
  )
}
