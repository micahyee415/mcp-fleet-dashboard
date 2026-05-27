'use client'

import type { HealthResult } from '@/lib/types'
import { MCP_SERVERS } from '@/lib/servers'
import { formatDistanceToNow } from 'date-fns'

interface StatusBarProps {
  health: HealthResult[]
  selectedServer: string
}

function statusColor(status: HealthResult['status']) {
  return {
    up: 'bg-green-500',
    down: 'bg-red-500',
    degraded: 'bg-amber-500',
  }[status]
}

function statusLabel(status: HealthResult['status']) {
  return { up: 'Live', down: 'Down', degraded: 'Degraded' }[status]
}

function StatusPill({ status }: { status: HealthResult['status'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${statusColor(status)}`} />
      {statusLabel(status)}
    </span>
  )
}

function ServerCard({ result }: { result: HealthResult }) {
  const server = MCP_SERVERS.find((s) => s.id === result.serverId)
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-900">{server?.label ?? result.serverId}</p>
        <StatusPill status={result.status} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-gray-500">
        {result.latencyMs !== null && (
          <p>Response: <span className="font-mono text-gray-700">{result.latencyMs}ms</span></p>
        )}
        {result.error && (
          <p className="text-red-500 truncate">{result.error}</p>
        )}
        <p>
          Checked{' '}
          {formatDistanceToNow(new Date(result.checkedAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

export function StatusBar({ health, selectedServer }: StatusBarProps) {
  const displayed =
    selectedServer === 'all'
      ? health
      : health.filter((h) => h.serverId === selectedServer)

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {displayed.map((result) => (
        <ServerCard key={result.serverId} result={result} />
      ))}
    </div>
  )
}
