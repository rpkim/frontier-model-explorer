import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, localeFromAcceptLanguage, parseLocale, type Locale } from "./locales"

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const fromCookie = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value)
  if (fromCookie) return fromCookie

  const headerStore = await headers()
  return localeFromAcceptLanguage(headerStore.get("accept-language")) ?? DEFAULT_LOCALE
}
