'use client'

import { format } from 'date-fns'
import type { AuditEntry, SecurityHighlight } from '@/lib/types'
import { MCP_SERVERS } from '@/lib/servers'

interface AuditSectionProps {
  entries: AuditEntry[]
  highlights: SecurityHighlight[]
  selectedServer: string
}

function statusCodeColor(code: number) {
  if (code >= 500) return 'text-red-600'
  if (code >= 400) return 'text-amber-600'
  return 'text-green-600'
}

const HIGHLIGHT_LABELS: Record<string, string> = {
  auth_failure: 'Auth Failure',
  write_op: 'Write Operation',
  rate_limit: 'Rate Limited',
  error_spike: 'Error Spike (>5%)',
  slow_request: 'Slow Requests (>30s)',
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  auth_failure: 'bg-red-50 border-red-200 text-red-700',
  write_op: 'bg-amber-50 border-amber-200 text-amber-700',
  rate_limit: 'bg-orange-50 border-orange-200 text-orange-700',
  error_spike: 'bg-red-50 border-red-200 text-red-700',
  slow_request: 'bg-yellow-50 border-yellow-200 text-yellow-700',
}

export function AuditSection({ entries, highlights, selectedServer }: AuditSectionProps) {
  const displayedEntries = selectedServer === 'all'
    ? entries
    : entries.filter((e) => e.serverId === selectedServer)

  const displayedHighlights = selectedServer === 'all'
    ? highlights
    : highlights.filter((h) => h.serverId === selectedServer)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Recent Activity ({displayedEntries.length})
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Server</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Tool</th>
                <th className="px-3 py-2 text-right">Duration</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedEntries.slice(0, 100).map((entry, i) => {
                const server = MCP_SERVERS.find((s) => s.id === entry.serverId)
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {format(new Date(entry.timestamp), 'HH:mm:ss')}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{server?.label ?? entry.serverId}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {entry.userEmail.replace('@example.com', '')}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900">{entry.tool}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-500">
                      {entry.durationMs}ms
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${statusCodeColor(entry.statusCode)}`}>
                      {entry.statusCode}
                    </td>
                  </tr>
                )
              })}
              {displayedEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    No activity in selected window
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Security Highlights</h3>
        <div className="space-y-3">
          {displayedHighlights.map((h, i) => {
            const server = MCP_SERVERS.find((s) => s.id === h.serverId)
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 text-xs ${HIGHLIGHT_COLORS[h.eventType] ?? 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-semibold">{HIGHLIGHT_LABELS[h.eventType]}</span>
                  <span className="font-mono">{h.count}×</span>
                </div>
                <p className="mt-1">{server?.label ?? h.serverId}</p>
                {h.userEmail && <p className="font-mono">{h.userEmail}</p>}
                <p className="mt-1 text-xs opacity-70">
                  Last: {h.lastOccurrence ? format(new Date(h.lastOccurrence), 'HH:mm') : '—'}
                </p>
              </div>
            )
          })}
          {displayedHighlights.length === 0 && (
            <div className="rounded-lg border border-gray-200 p-4 text-center text-xs text-gray-400">
              No flagged events in this window
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
