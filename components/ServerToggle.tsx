'use client'

import type { HealthResult, TimeRange } from '@/lib/types'
import { MCP_SERVERS } from '@/lib/servers'

interface ServerToggleProps {
  selected: string
  onSelect: (id: string) => void
  health: HealthResult[]
  range: TimeRange
  onRangeChange: (r: TimeRange) => void
}

function statusDot(status: HealthResult['status'] | undefined) {
  if (!status) return 'bg-gray-300'
  return { up: 'bg-green-500', down: 'bg-red-500', degraded: 'bg-amber-500' }[status]
}

const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d']

export function ServerToggle({ selected, onSelect, health, range, onRangeChange }: ServerToggleProps) {
  const tabs = [
    { id: 'all', label: 'All Servers' },
    ...MCP_SERVERS.map((s) => ({ id: s.id, label: s.label })),
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const serverHealth = health.find((h) => h.serverId === tab.id)
          const isActive = selected === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.id !== 'all' && (
                <span className={`h-2 w-2 rounded-full ${statusDot(serverHealth?.status)}`} />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              range === r
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}
