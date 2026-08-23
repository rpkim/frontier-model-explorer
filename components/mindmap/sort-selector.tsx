"use client"

import { ArrowUpDownIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SORT_OPTIONS, type SortKey } from "@/lib/aa/sort"
import { useI18n } from "@/lib/i18n/provider"
import { cn } from "@/lib/utils"

export function SortSelector({
  value,
  onChange,
  className,
}: {
  value: SortKey
  onChange: (value: SortKey) => void
  className?: string
}) {
  const { t } = useI18n()

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 sm:gap-2", className)}>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{t("sort.label")}</span>
      <div className="min-w-0 flex-1 sm:flex-none">
      <Select
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as SortKey)
        }}
      >
        <SelectTrigger size="sm" aria-label={t("sort.label")} className="w-full min-w-0 sm:w-fit sm:min-w-40">
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
    </div>
  )
}
