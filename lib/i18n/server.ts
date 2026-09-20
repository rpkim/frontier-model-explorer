import { cookies } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "./locales"

/**
 * First visits always get DEFAULT_LOCALE; `Accept-Language` is deliberately not
 * consulted so the landing experience is one predictable language. The switcher
 * writes a cookie, which then wins on every later request.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return parseLocale(cookieStore.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE
}
