"use client"

import { ArrowUpDownIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SORT_OPTIONS, type SortKey } from "@/lib/aa/sort"
import { useI18n } from "@/lib/i18n/provider"

export function SortSelector({
  value,
  onChange,
}: {
  value: SortKey
  onChange: (value: SortKey) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t("sort.label")}</span>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as SortKey)
        }}
      >
        <SelectTrigger size="sm" aria-label={t("sort.label")} className="min-w-40">
          <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
          <SelectValue>
            {(selected: string | null) => {
              const opt = SORT_OPTIONS.find((item) => item.key === selected)
              return opt ? t(opt.labelKey) : null
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.key} value={opt.key}>
              {t(opt.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
