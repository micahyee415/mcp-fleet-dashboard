// app/page.tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { checkAllHealth } from '@/lib/health'
import { getMetrics } from '@/lib/monitoring'
import { getAllAuditLogs, deriveSecurityHighlights } from '@/lib/logging'
import { MCP_SERVERS } from '@/lib/servers'
import { Dashboard } from '@/components/Dashboard'

export default async function Page() {
  const session = await auth()
  if (!session) redirect('/api/auth/signin')

  const DEFAULT_RANGE = '24h'

  // Fetch all three pipelines in parallel
  const [health, metricsResults, auditEntries] = await Promise.all([
    checkAllHealth(),
    Promise.allSettled(MCP_SERVERS.map((s) => getMetrics(s.service, DEFAULT_RANGE, s.id))),
    getAllAuditLogs(DEFAULT_RANGE),
  ])

  const metrics = metricsResults
    .map((r) => r.status === 'fulfilled' ? r.value : null)
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const highlights = deriveSecurityHighlights(auditEntries)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MCP Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitoring {MCP_SERVERS.length} servers · {session.user?.email}
            </p>
          </div>
        </div>

        <Dashboard
          initialHealth={health}
          initialMetrics={metrics}
          initialAudit={auditEntries}
          initialHighlights={highlights}
          initialFetchedAt={new Date().toISOString()}
        />
      </div>
    </main>
  )
}
