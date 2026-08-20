"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GROUP_BY_OPTIONS, type GroupByKey } from "@/lib/aa/group-by"

export function GroupBySelector({
  value,
  onChange,
}: {
  value: GroupByKey
  onChange: (value: GroupByKey) => void
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
      <span className="text-xs font-medium text-muted-foreground">기준</span>
      <ToggleGroup
        value={[value]}
        onValueChange={(next) => {
          const nextValue = next[0]
          if (nextValue) onChange(nextValue as GroupByKey)
        }}
        variant="outline"
        size="sm"
        className="flex-wrap justify-start"
      >
        {GROUP_BY_OPTIONS.map((opt) => (
          <ToggleGroupItem key={opt.key} value={opt.key} aria-label={opt.description} className="text-xs">
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
