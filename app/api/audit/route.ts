import { auth } from '@/auth'
import { getAuditLogs, getAllAuditLogs, deriveSecurityHighlights } from '@/lib/logging'
import { rateLimit } from '@/lib/rate-limit'
import { getServer } from '@/lib/servers'
import type { TimeRange } from '@/lib/types'

const VALID_RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ok } = rateLimit(session.user?.email ?? 'unknown')
  if (!ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  const { searchParams } = new URL(request.url)
  const serverId = searchParams.get('server') ?? 'all'
  const range = (searchParams.get('range') ?? '24h') as TimeRange

  if (!VALID_RANGES.includes(range)) {
    return Response.json({ error: 'Invalid range' }, { status: 400 })
  }

  try {
    const entries = serverId === 'all'
      ? await getAllAuditLogs(range)
      : await (async () => {
          const server = getServer(serverId)
          if (!server) return null
          return getAuditLogs(server.service, server.id, range)
        })()

    if (entries === null) return Response.json({ error: 'Unknown server' }, { status: 404 })

    const highlights = deriveSecurityHighlights(entries)
    return Response.json({ data: entries, highlights, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[/api/audit] error:', err)
    return Response.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
