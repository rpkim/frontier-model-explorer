import { LOCALE_META, type Locale } from "@/lib/i18n/locales"
import type { TFunction } from "@/lib/i18n/translate"

export function formatPrice(value: number | null): string {
  if (value === null) return "—"
  if (value < 1) return `$${value.toFixed(3)}`
  return `$${value.toFixed(2)}`
}

export function formatSpeed(value: number | null): string {
  if (value === null) return "—"
  return `${value.toFixed(0)} tok/s`
}

export function formatSeconds(value: number | null): string {
  if (value === null) return "—"
  if (value < 1) return `${(value * 1000).toFixed(0)}ms`
  return `${value.toFixed(2)}s`
}

export function formatScore(value: number | null, digits = 1): string {
  if (value === null) return "—"
  return value.toFixed(digits)
}

export function formatParams(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—"
  if (value >= 1e12) return `${trimZeros(value / 1e12)}T`
  if (value >= 1e9) return `${trimZeros(value / 1e9)}B`
  if (value >= 1e6) return `${trimZeros(value / 1e6)}M`
  if (value >= 1e3) return `${trimZeros(value / 1e3)}K`
  return String(Math.round(value))
}

export function formatGb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  if (value < 10) return `${value.toFixed(1)} GB`
  return `${Math.round(value)} GB`
}

function trimZeros(value: number): string {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return Number(value.toFixed(digits)).toString()
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—"
  return `${(value * 100).toFixed(1)}%`
}

export function formatDate(value: string | null, locale: Locale, unknownLabel: string): string {
  if (!value) return unknownLabel
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(LOCALE_META[locale].bcp47, { year: "numeric", month: "short", day: "numeric" })
}

export function timeAgo(iso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return t("format.justNow")
  if (mins < 60) return t("format.minutesAgo", { n: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t("format.hoursAgo", { n: hours })
  const days = Math.round(hours / 24)
  return t("format.daysAgo", { n: days })
}
