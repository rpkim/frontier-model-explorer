export const LOCALES = ["en", "ko", "ja", "zh"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

export const LOCALE_COOKIE = "fme-locale"

/** English names of each locale, for telling an LLM which language to write in. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Simplified Chinese",
}

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
