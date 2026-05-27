import { auth } from '@/auth'
import { getMetrics } from '@/lib/monitoring'
import { rateLimit } from '@/lib/rate-limit'
import { MCP_SERVERS, getServer } from '@/lib/servers'
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
    if (serverId === 'all') {
      const results = await Promise.allSettled(
        MCP_SERVERS.map((s) => getMetrics(s.service, range, s.id))
      )
      const data = results.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : { serverId: MCP_SERVERS[i].id, error: 'Failed to fetch metrics' }
      )
      return Response.json({ data, fetchedAt: new Date().toISOString() })
    }

    const server = getServer(serverId)
    if (!server) return Response.json({ error: 'Unknown server' }, { status: 404 })

    const data = await getMetrics(server.service, range, server.id)
    return Response.json({ data, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[/api/metrics] error:', err)
    return Response.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }
}
