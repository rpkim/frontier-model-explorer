"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { colorForKey } from "@/lib/aa/colors"
import type { Group } from "@/lib/aa/group-by"
import { useI18n } from "@/lib/i18n/provider"

export function GroupColumn({
  groups,
  selectedId,
  onSelect,
}: {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex h-full w-full shrink-0 flex-col sm:w-64">
      <div className="border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("groups.label")} <span className="font-mono">{groups.length}</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5 p-2">
          {groups.map((group) => {
            const active = group.id === selectedId
            const dot = colorForKey(group.id)
            const label = group.labelKey ? t(group.labelKey) : group.label
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => onSelect(group.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    active ? "bg-primary/15 text-foreground" : "text-foreground/85 hover:bg-accent",
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dot }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate">
                    <span className="block truncate leading-tight font-medium">{label}</span>
                    {group.sublabel && (
                      <span className="block truncate text-xs text-muted-foreground">{group.sublabel}</span>
                    )}
                  </span>
                  <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                    {group.models.length}
                  </Badge>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
