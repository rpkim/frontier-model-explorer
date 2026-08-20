"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueryState } from "@/hooks/use-query-state"
import type { ModelNode } from "@/lib/aa/types"
import { MindMapExplorer } from "@/components/mindmap/mind-map-explorer"
import { CompareExplorer } from "@/components/compare/compare-explorer"

const MAX_COMPARE_MODELS = 4

export function ExplorerTabs({ models }: { models: ModelNode[] }) {
  const { get, set } = useQueryState()
  const tab = get("tab") === "compare" ? "compare" : "mindmap"

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
            마인드맵 탐색
          </TabsTrigger>
          <TabsTrigger
            value="compare"
            className="rounded-none border-b-2 border-transparent bg-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            모델 비교
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="mindmap" className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <MindMapExplorer models={models} onAddToCompare={addToCompare} />
      </TabsContent>
      <TabsContent value="compare" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
        <CompareExplorer models={models} />
      </TabsContent>
    </Tabs>
  )
}
