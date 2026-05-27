'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import type { ServerMetrics, TimeRange } from '@/lib/types'
import { MCP_SERVERS } from '@/lib/servers'

interface MetricsSectionProps {
  metrics: ServerMetrics[]
  selectedServer: string
  range: TimeRange
}

const SERVER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
]

function formatTs(iso: string) {
  try {
    return format(new Date(iso), 'HH:mm')
  } catch {
    return iso
  }
}

export function MetricsSection({ metrics, selectedServer, range }: MetricsSectionProps) {
  const displayed = selectedServer === 'all'
    ? metrics
    : metrics.filter((m) => m.serverId === selectedServer)

  const allTimestamps = Array.from(
    new Set(displayed.flatMap((m) => m.requestCount.map((p) => p.timestamp)))
  ).sort()

  const requestData = allTimestamps.map((ts) => {
    const row: Record<string, string | number> = { ts: formatTs(ts) }
    for (const m of displayed) {
      const pt = m.requestCount.find((p) => p.timestamp === ts)
      row[m.serverId] = pt?.value ?? 0
    }
    return row
  })

  const latencyData = allTimestamps.map((ts) => {
    const row: Record<string, string | number> = { ts: formatTs(ts) }
    for (const m of displayed) {
      row[`${m.serverId}_p50`] = m.p50LatencyMs
      row[`${m.serverId}_p99`] = m.p99LatencyMs
    }
    return row
  })

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Server</th>
              <th className="px-4 py-3 text-right">Requests</th>
              <th className="px-4 py-3 text-right">Errors</th>
              <th className="px-4 py-3 text-right">Error Rate</th>
              <th className="px-4 py-3 text-right">p50 Latency</th>
              <th className="px-4 py-3 text-right">p99 Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map((m) => {
              const server = MCP_SERVERS.find((s) => s.id === m.serverId)
              const totalReqs = m.requestCount.reduce((s, p) => s + p.value, 0)
              const totalErrors = m.errorCount.reduce((s, p) => s + p.value, 0)
              return (
                <tr key={m.serverId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{server?.label ?? m.serverId}</td>
                  <td className="px-4 py-3 text-right font-mono">{totalReqs.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">{totalErrors.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-mono ${m.errorRate > 5 ? 'text-red-600 font-semibold' : ''}`}>
                    {m.errorRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{Math.round(m.p50LatencyMs)}ms</td>
                  <td className="px-4 py-3 text-right font-mono">{Math.round(m.p99LatencyMs)}ms</td>
                </tr>
              )
            })}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No metrics data in selected window
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Request Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={requestData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {selectedServer === 'all' && <Legend />}
              {displayed.map((m, i) => (
                <Bar key={m.serverId} dataKey={m.serverId} fill={SERVER_COLORS[i % SERVER_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">Latency (ms)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {displayed.flatMap((m, i) => [
                <Line key={`${m.serverId}-p50`} dataKey={`${m.serverId}_p50`}
                  stroke={SERVER_COLORS[i % SERVER_COLORS.length]}
                  strokeWidth={2} dot={false} name={`${m.serverId} p50`} />,
                <Line key={`${m.serverId}-p99`} dataKey={`${m.serverId}_p99`}
                  stroke={SERVER_COLORS[i % SERVER_COLORS.length]}
                  strokeWidth={1} strokeDasharray="4 2" dot={false} name={`${m.serverId} p99`} />,
              ])}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
