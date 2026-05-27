import { auth } from '@/auth'
import { checkAllHealth } from '@/lib/health'
import { rateLimit } from '@/lib/rate-limit'

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ok } = rateLimit(session.user?.email ?? 'unknown')
  if (!ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  try {
    const results = await checkAllHealth()
    return Response.json({ data: results, fetchedAt: new Date().toISOString() })
  } catch {
    return Response.json({ error: 'Health check failed' }, { status: 500 })
  }
}
