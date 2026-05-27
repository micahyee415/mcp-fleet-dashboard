// lib/types.ts

export interface McpServer {
  id: string
  label: string
  service: string        // Cloud Run service name in your-gcp-project project
  healthUrl: string      // Full URL to /health endpoint
}

export type TimeRange = '1h' | '6h' | '24h' | '7d'

export interface HealthResult {
  serverId: string
  status: 'up' | 'down' | 'degraded'
  latencyMs: number | null
  checkedAt: string      // ISO 8601
  error?: string
}

export interface TimeSeriesPoint {
  timestamp: string      // ISO 8601
  value: number
}

export interface ServerMetrics {
  serverId: string
  requestCount: TimeSeriesPoint[]
  errorCount: TimeSeriesPoint[]
  errorRate: number              // 0–100 percentage
  p50LatencyMs: number
  p99LatencyMs: number
}

export interface AuditEntry {
  timestamp: string
  serverId: string
  userEmail: string
  tool: string
  durationMs: number
  statusCode: number
}

export type SecurityEventType = 'auth_failure' | 'write_op' | 'rate_limit' | 'error_spike' | 'slow_request'

export interface SecurityHighlight {
  serverId: string
  userEmail: string
  eventType: SecurityEventType
  count: number
  lastOccurrence: string   // ISO 8601
}
