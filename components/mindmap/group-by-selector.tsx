"use client"

import { LayersIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GROUP_BY_OPTIONS, type GroupByKey } from "@/lib/aa/group-by"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

export function GroupBySelector({
  value,
  onChange,
  className,
}: {
  value: GroupByKey
  onChange: (value: GroupByKey) => void
  className?: string
}) {
  const { t } = useI18n()

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-w-0 items-center gap-1.5 sm:hidden">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{t("groupBy.label")}</span>
        <div className="min-w-0 flex-1">
        <Select
          value={value}
          onValueChange={(next) => {
            if (next) onChange(next as GroupByKey)
          }}
        >
          <SelectTrigger size="sm" aria-label={t("groupBy.label")} className="w-full min-w-0">
            <LayersIcon className="size-3.5 text-muted-foreground" />
            <SelectValue>
              {(selected: string | null) => {
                const opt = GROUP_BY_OPTIONS.find((item) => item.key === selected)
                return opt ? t(opt.labelKey) : null
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {GROUP_BY_OPTIONS.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs font-medium text-muted-foreground">{t("groupBy.label")}</span>
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
            <ToggleGroupItem key={opt.key} value={opt.key} aria-label={t(opt.hintKey)} className="text-xs">
              {t(opt.labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
