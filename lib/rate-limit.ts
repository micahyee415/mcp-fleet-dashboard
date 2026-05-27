// Simple in-memory rate limiter per user.
// Resets on cold start (Vercel serverless) — acceptable for an internal
// dashboard with few @example.com users. Prevents accidental API hammering.
const requests = new Map<string, { count: number; resetAt: number }>()

const DEFAULT_LIMIT = 60
const DEFAULT_WINDOW_MS = 60_000

export function rateLimit(
  userEmail: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = requests.get(userEmail)

  if (!entry || now > entry.resetAt) {
    requests.set(userEmail, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  entry.count++
  if (entry.count >= limit) {
    return { ok: false, remaining: 0 }
  }
  return { ok: true, remaining: limit - entry.count }
}
