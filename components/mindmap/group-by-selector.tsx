"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { GROUP_BY_OPTIONS, type GroupByKey } from "@/lib/aa/group-by"
import { useI18n } from "@/lib/i18n/provider"

export function GroupBySelector({
  value,
  onChange,
}: {
  value: GroupByKey
  onChange: (value: GroupByKey) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
  )
}
