"use client"

import { cn } from "@/lib/utils"
import { colorForKey } from "@/lib/aa/colors"
import { highlightMetricFor, type GroupByKey } from "@/lib/aa/group-by"
import type { ModelNode } from "@/lib/aa/types"

const MAX_INTELLIGENCE = 75

export function ModelColumn({
  models,
  groupBy,
  selectedId,
  onSelect,
}: {
  models: ModelNode[]
  groupBy: GroupByKey
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col sm:w-72">
      <div className="border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          모델 <span className="font-mono">{models.length}</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5 p-2">
          {models.map((model) => {
            const active = model.id === selectedId
            const highlight = highlightMetricFor(groupBy, model)
            const intelPct = model.intelligenceIndex
              ? Math.min(100, (model.intelligenceIndex / MAX_INTELLIGENCE) * 100)
              : 0
            return (
              <li key={model.id}>
                <button
                  type="button"
                  onClick={() => onSelect(model.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    active ? "bg-primary/15 text-foreground" : "text-foreground/85 hover:bg-accent",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorForKey(model.provider.slug) }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate font-medium leading-tight">{model.name}</span>
                  </div>
                  {groupBy !== "provider" && (
                    <span className="truncate pl-3.5 text-xs text-muted-foreground">{model.provider.name}</span>
                  )}
                  {highlight ? (
                    <span className="pl-3.5 font-mono text-xs text-primary">{highlight.value}</span>
                  ) : (
                    <div className="flex items-center gap-1.5 pl-3.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${intelPct}%` }} />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {model.intelligenceIndex?.toFixed(0) ?? "—"}
                      </span>
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
