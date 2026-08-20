"use client"

import { GlobeIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/locales"
import { useI18n } from "@/lib/i18n/provider"

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <Select
      value={locale}
      onValueChange={(next) => {
        if (next) setLocale(next as Locale)
      }}
    >
      <SelectTrigger size="sm" aria-label={t("language.label")} className="min-w-28">
        <GlobeIcon className="size-3.5 text-muted-foreground" />
        <SelectValue>{(value: string | null) => (value ? LOCALE_META[value as Locale]?.nativeName : null)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {LOCALE_META[code].nativeName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
