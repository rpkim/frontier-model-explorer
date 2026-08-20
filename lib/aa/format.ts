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

export function formatPercent(value: number | null): string {
  if (value === null) return "—"
  return `${(value * 100).toFixed(1)}%`
}

export function formatDate(value: string | null): string {
  if (!value) return "출시일 미정"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return "방금 전"
  if (mins < 60) return `${mins}분 전`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.round(hours / 24)
  return `${days}일 전`
}
