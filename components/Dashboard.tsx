// components/Dashboard.tsx
'use client'

import { useState, useCallback } from 'react'
import { ServerToggle } from './ServerToggle'
import { StatusBar } from './StatusBar'
import { MetricsSection } from './MetricsSection'
import { AuditSection } from './AuditSection'
import { RefreshButton } from './RefreshButton'
import type { HealthResult, ServerMetrics, AuditEntry, SecurityHighlight, TimeRange } from '@/lib/types'

interface DashboardProps {
  initialHealth: HealthResult[]
  initialMetrics: ServerMetrics[]
  initialAudit: AuditEntry[]
  initialHighlights: SecurityHighlight[]
  initialFetchedAt: string
}

export function Dashboard({
  initialHealth,
  initialMetrics,
  initialAudit,
  initialHighlights,
  initialFetchedAt,
}: DashboardProps) {
  const [selectedServer, setSelectedServer] = useState('all')
  const [range, setRange] = useState<TimeRange>('24h')
  const [health, setHealth] = useState(initialHealth)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [audit, setAudit] = useState(initialAudit)
  const [highlights, setHighlights] = useState(initialHighlights)
  const [fetchedAt, setFetchedAt] = useState(initialFetchedAt)
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async (newRange?: TimeRange, newServer?: string) => {
    const r = newRange ?? range
    const s = newServer ?? selectedServer
    setLoading(true)
    try {
      const [healthRes, metricsRes, auditRes] = await Promise.allSettled([
        fetch('/api/health').then((r) => { if (!r.ok) throw new Error(`health ${r.status}`); return r.json() }),
        fetch(`/api/metrics?server=${encodeURIComponent(s)}&range=${encodeURIComponent(r)}`).then((r) => { if (!r.ok) throw new Error(`metrics ${r.status}`); return r.json() }),
        fetch(`/api/audit?server=${encodeURIComponent(s)}&range=${encodeURIComponent(r)}`).then((r) => { if (!r.ok) throw new Error(`audit ${r.status}`); return r.json() }),
      ])

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data)
      if (metricsRes.status === 'fulfilled') setMetrics(
        Array.isArray(metricsRes.value.data) ? metricsRes.value.data : [metricsRes.value.data]
      )
      if (auditRes.status === 'fulfilled') {
        setAudit(auditRes.value.data)
        setHighlights(auditRes.value.highlights)
      }
      setFetchedAt(new Date().toISOString())
    } finally {
      setLoading(false)
    }
  }, [range, selectedServer])

  async function handleRefresh() {
    await fetch('/api/refresh', { method: 'POST' })
    await fetchAll()
  }

  async function handleRangeChange(newRange: TimeRange) {
    setRange(newRange)
    await fetchAll(newRange)
  }

  async function handleServerChange(newServer: string) {
    setSelectedServer(newServer)
    await fetchAll(undefined, newServer)
  }

  return (
    <div className={`space-y-8 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <ServerToggle
          selected={selectedServer}
          onSelect={handleServerChange}
          health={health}
          range={range}
          onRangeChange={handleRangeChange}
        />
        <RefreshButton onRefresh={handleRefresh} lastUpdated={fetchedAt} />
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</h2>
        <StatusBar health={health} selectedServer={selectedServer} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Usage & Performance</h2>
        <MetricsSection metrics={metrics} selectedServer={selectedServer} range={range} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Audit & Security</h2>
        <AuditSection entries={audit} highlights={highlights} selectedServer={selectedServer} />
      </section>
    </div>
  )
}
