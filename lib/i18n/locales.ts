export const LOCALES = ["ko", "en", "ja", "zh"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "ko"

export const LOCALE_COOKIE = "fme-locale"

export const LOCALE_META: Record<Locale, { nativeName: string; bcp47: string }> = {
  ko: { nativeName: "한국어", bcp47: "ko-KR" },
  en: { nativeName: "English", bcp47: "en-US" },
  ja: { nativeName: "日本語", bcp47: "ja-JP" },
  zh: { nativeName: "中文", bcp47: "zh-CN" },
}

export function parseLocale(value: string | null | undefined): Locale | null {
  if (!value) return null
  const normalized = value.toLowerCase().split("-")[0]
  return LOCALES.includes(normalized as Locale) ? (normalized as Locale) : null
}

export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=")
      return { tag: tag.trim().toLowerCase(), q: q ? Number.parseFloat(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { tag } of tags) {
    const locale = parseLocale(tag)
    if (locale) return locale
  }
  return null
}
