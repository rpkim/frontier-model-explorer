type Bucket = { count: number; resetAt: number }

const store = new Map<string, Bucket>()

/** Best-effort in-memory limiter (per server instance). Suitable for abuse reduction, not strong guarantees. */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    return { allowed: false, retryAfterSec }
  }

  bucket.count += 1
  return { allowed: true }
}

export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}
