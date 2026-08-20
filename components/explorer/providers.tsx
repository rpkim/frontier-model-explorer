"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { LanguageProvider } from "@/lib/i18n/provider"
import type { Locale } from "@/lib/i18n/locales"

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return (
    <LanguageProvider initialLocale={locale}>
      <TooltipProvider>{children}</TooltipProvider>
    </LanguageProvider>
  )
}
