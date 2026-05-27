// lib/logging.ts
import { getLoggingClient, projectId } from './gcp'
import { MCP_SERVERS } from './servers'
import type { AuditEntry, SecurityHighlight, TimeRange } from './types'

// Servers log canWrite:true for mutating operations; fall back to message prefix check
const WRITE_MESSAGES = ['write', 'create', 'update', 'delete', 'insert', 'mutation']
const MAX_ENTRIES = 100

function rangeToISO(range: TimeRange): string {
  const seconds = { '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800 }
  return new Date(Date.now() - seconds[range] * 1000).toISOString()
}

export function parseLogEntry(raw: any, serverId: string): AuditEntry | null {
  try {
    // @google-cloud/logging Entry objects expose the payload in raw.data (plain JS
    // object) and metadata in raw.metadata.  The legacy protobuf-Struct path
    // (raw.jsonPayload.fields.*Value) is kept as a fallback.
    const data: Record<string, unknown> =
      raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? (raw.data as Record<string, unknown>)
        : {}
    const fields: Record<string, { stringValue?: string; numberValue?: number }> =
      (raw.jsonPayload?.fields as Record<string, { stringValue?: string; numberValue?: number }>) ?? {}

    const userEmail =
      (typeof data.userEmail === 'string' ? data.userEmail : undefined) ??
      fields.userEmail?.stringValue
    if (!userEmail) return null

    // Timestamp: Entry objects store it in raw.metadata.timestamp (string or
    // Date); raw API format uses raw.timestamp.seconds (number).
    let timestamp: string
    const metaTs = raw.metadata?.timestamp
    if (metaTs) {
      timestamp = typeof metaTs === 'string' ? metaTs : new Date(metaTs as string | number).toISOString()
    } else if (raw.timestamp?.seconds) {
      timestamp = new Date(Number(raw.timestamp.seconds) * 1000).toISOString()
    } else {
      timestamp = new Date().toISOString()
    }

    const message =
      (typeof data.message === 'string' ? data.message : undefined) ??
      fields.message?.stringValue ??
      'request'

    return {
      timestamp,
      serverId,
      userEmail,
      tool: message,
      durationMs: Number(data.durationMs ?? fields.durationMs?.numberValue ?? 0),
      statusCode: Number(data.statusCode ?? fields.statusCode?.numberValue ?? 0),
    }
  } catch {
    return null
  }
}

export function deriveSecurityHighlights(entries: AuditEntry[]): SecurityHighlight[] {
  const highlights: SecurityHighlight[] = []
  if (entries.length === 0) return highlights

  // Auth failures: 401 or 403, grouped by server + user
  const authFails = entries.filter((e) => e.statusCode === 401 || e.statusCode === 403)
  if (authFails.length > 0) {
    const byKey = new Map<string, { serverId: string; userEmail: string; count: number; last: string }>()
    for (const e of authFails) {
      const key = `${e.serverId}::${e.userEmail}`
      const curr = byKey.get(key) ?? { serverId: e.serverId, userEmail: e.userEmail, count: 0, last: e.timestamp }
      byKey.set(key, {
        ...curr,
        count: curr.count + 1,
        last: e.timestamp > curr.last ? e.timestamp : curr.last,
      })
    }
    for (const { serverId, userEmail, count, last } of byKey.values()) {
      highlights.push({ serverId, userEmail, eventType: 'auth_failure', count, lastOccurrence: last })
    }
  }

  // Write operations, grouped by server + user
  const writeOps = entries.filter((e) => WRITE_MESSAGES.some((w) => e.tool.toLowerCase().includes(w)))
  if (writeOps.length > 0) {
    const byKey = new Map<string, { serverId: string; userEmail: string; count: number; last: string }>()
    for (const e of writeOps) {
      const key = `${e.serverId}::${e.userEmail}`
      const curr = byKey.get(key) ?? { serverId: e.serverId, userEmail: e.userEmail, count: 0, last: e.timestamp }
      byKey.set(key, {
        ...curr,
        count: curr.count + 1,
        last: e.timestamp > curr.last ? e.timestamp : curr.last,
      })
    }
    for (const { serverId, userEmail, count, last } of byKey.values()) {
      highlights.push({ serverId, userEmail, eventType: 'write_op', count, lastOccurrence: last })
    }
  }

  // Rate limit hits: 429, grouped by server + user
  const rateLimits = entries.filter((e) => e.statusCode === 429)
  if (rateLimits.length > 0) {
    const byKey = new Map<string, { serverId: string; userEmail: string; count: number; last: string }>()
    for (const e of rateLimits) {
      const key = `${e.serverId}::${e.userEmail}`
      const curr = byKey.get(key) ?? { serverId: e.serverId, userEmail: e.userEmail, count: 0, last: e.timestamp }
      byKey.set(key, {
        ...curr,
        count: curr.count + 1,
        last: e.timestamp > curr.last ? e.timestamp : curr.last,
      })
    }
    for (const { serverId, userEmail, count, last } of byKey.values()) {
      highlights.push({ serverId, userEmail, eventType: 'rate_limit', count, lastOccurrence: last })
    }
  }

  // Error spike: >5% 5xx, reported per server
  const errorEntries = entries.filter((e) => e.statusCode >= 500)
  if (entries.length > 0 && errorEntries.length / entries.length > 0.05) {
    const lastError = errorEntries[errorEntries.length - 1]
    highlights.push({
      serverId: lastError.serverId,
      userEmail: '',
      eventType: 'error_spike',
      count: errorEntries.length,
      lastOccurrence: lastError.timestamp,
    })
  }

  // Slow requests: >30s duration, grouped by server + user
  const SLOW_THRESHOLD_MS = 30_000
  const slowOps = entries.filter((e) => e.durationMs > SLOW_THRESHOLD_MS)
  if (slowOps.length > 0) {
    const byServerUser = new Map<string, { serverId: string; userEmail: string; count: number; last: string }>()
    for (const e of slowOps) {
      const key = `${e.serverId}::${e.userEmail}`
      const curr = byServerUser.get(key) ?? { serverId: e.serverId, userEmail: e.userEmail, count: 0, last: e.timestamp }
      byServerUser.set(key, {
        ...curr,
        count: curr.count + 1,
        last: e.timestamp > curr.last ? e.timestamp : curr.last,
      })
    }
    for (const { serverId, userEmail, count, last } of byServerUser.values()) {
      highlights.push({
        serverId,
        userEmail,
        eventType: 'slow_request',
        count,
        lastOccurrence: last,
      })
    }
  }

  return highlights
}

async function fetchAuditLogs(
  service: string,
  serverId: string,
  range: TimeRange
): Promise<AuditEntry[]> {
  const start = rangeToISO(range)
  const filter = [
    `resource.type="cloud_run_revision"`,
    `resource.labels.service_name="${service}"`,
    `jsonPayload.userEmail!=""`,
    `timestamp>="${start}"`,
  ].join('\n')

  const [entries] = await getLoggingClient().getEntries({
    filter,
    pageSize: MAX_ENTRIES,
    orderBy: 'timestamp desc',
    resourceNames: [`projects/${projectId}`],
  })

  return entries
    .map((e: any) => parseLogEntry(e, serverId))
    .filter((e: AuditEntry | null): e is AuditEntry => e !== null)
}

// Audit logs are security data — always fetch fresh, no caching.
export async function getAuditLogs(
  service: string,
  serverId: string,
  range: TimeRange
): Promise<AuditEntry[]> {
  return fetchAuditLogs(service, serverId, range)
}

export async function getAllAuditLogs(range: TimeRange): Promise<AuditEntry[]> {
  const results = await Promise.allSettled(
    MCP_SERVERS.map((s) => fetchAuditLogs(s.service, s.id, range))
  )
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_ENTRIES)
}
