// lib/__tests__/logging.test.ts
jest.mock('../gcp', () => ({
  getLoggingClient: () => ({ getEntries: jest.fn() }),
  projectId: 'your-gcp-project',
}))
jest.mock('next/cache', () => ({
  unstable_cache: (fn: any) => fn,
}))

import { parseLogEntry, deriveSecurityHighlights } from '../logging'
import type { AuditEntry } from '../types'

const makeEntry = (overrides: Partial<AuditEntry>): AuditEntry => ({
  timestamp: '2026-04-15T10:00:00Z',
  serverId: 'gong',
  userEmail: 'user@example.com',
  tool: 'list_calls',
  durationMs: 200,
  statusCode: 200,
  ...overrides,
})

describe('parseLogEntry', () => {
  it('parses a valid Cloud Logging JSON entry', () => {
    const raw = {
      timestamp: { seconds: 1744704000, nanos: 0 },
      jsonPayload: {
        fields: {
          userEmail: { stringValue: 'user@example.com' },
          message: { stringValue: 'list_calls' },
          durationMs: { numberValue: 200 },
          statusCode: { numberValue: 200 },
        },
      },
      resource: { labels: { service_name: 'gong-mcp' } },
    }
    const entry = parseLogEntry(raw, 'gong')
    expect(entry).not.toBeNull()
    expect(entry?.userEmail).toBe('user@example.com')
    expect(entry?.tool).toBe('list_calls')
    expect(entry?.durationMs).toBe(200)
    expect(entry?.statusCode).toBe(200)
    expect(entry?.serverId).toBe('gong')
  })

  it('returns null for entries missing tool field', () => {
    const raw = {
      timestamp: { seconds: 1744704000, nanos: 0 },
      jsonPayload: { fields: {} },
      resource: { labels: { service_name: 'gong-mcp' } },
    }
    expect(parseLogEntry(raw, 'gong')).toBeNull()
  })
})

describe('deriveSecurityHighlights', () => {
  it('flags auth failures (401/403)', () => {
    const entries = [
      makeEntry({ statusCode: 401, userEmail: 'bad@evil.com' }),
      makeEntry({ statusCode: 403, userEmail: 'bad@evil.com' }),
      makeEntry({ statusCode: 200 }),
    ]
    const highlights = deriveSecurityHighlights(entries)
    const authFailures = highlights.filter((h) => h.eventType === 'auth_failure')
    expect(authFailures).toHaveLength(1)
    expect(authFailures[0].count).toBe(2)
  })

  it('flags write operations (create_, update_, delete_ prefixes)', () => {
    const entries = [
      makeEntry({ tool: 'create_invoice' }),
      makeEntry({ tool: 'delete_payment' }),
      makeEntry({ tool: 'list_calls' }),
    ]
    const highlights = deriveSecurityHighlights(entries)
    const writeOps = highlights.filter((h) => h.eventType === 'write_op')
    expect(writeOps.length).toBeGreaterThan(0)
    const totalCount = writeOps.reduce((s, h) => s + h.count, 0)
    expect(totalCount).toBe(2)
  })

  it('flags rate limit hits (429)', () => {
    const entries = [makeEntry({ statusCode: 429 }), makeEntry({ statusCode: 200 })]
    const highlights = deriveSecurityHighlights(entries)
    const rateLimits = highlights.filter((h) => h.eventType === 'rate_limit')
    expect(rateLimits).toHaveLength(1)
    expect(rateLimits[0].count).toBe(1)
  })

  it('flags error spikes when error rate > 5%', () => {
    const entries = [
      ...Array(6).fill(null).map(() => makeEntry({ statusCode: 500 })),
      ...Array(94).fill(null).map(() => makeEntry({ statusCode: 200 })),
    ]
    const highlights = deriveSecurityHighlights(entries)
    const errorSpikes = highlights.filter((h) => h.eventType === 'error_spike')
    expect(errorSpikes).toHaveLength(1)
  })

  it('does not flag error spike when error rate <= 5%', () => {
    const entries = [
      ...Array(4).fill(null).map(() => makeEntry({ statusCode: 500 })),
      ...Array(96).fill(null).map(() => makeEntry({ statusCode: 200 })),
    ]
    const highlights = deriveSecurityHighlights(entries)
    const errorSpikes = highlights.filter((h) => h.eventType === 'error_spike')
    expect(errorSpikes).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(deriveSecurityHighlights([])).toHaveLength(0)
  })
})
