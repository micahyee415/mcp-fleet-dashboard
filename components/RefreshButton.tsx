'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface RefreshButtonProps {
  onRefresh: () => Promise<void>
  lastUpdated: string
}

export function RefreshButton({ onRefresh, lastUpdated }: RefreshButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleRefresh() {
    setLoading(true)
    try {
      await onRefresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      <span>
        Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
      </span>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}
