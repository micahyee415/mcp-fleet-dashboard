// lib/__tests__/monitoring.test.ts

// Mock GCP client to avoid needing GCP_SERVICE_ACCOUNT_KEY in test env
jest.mock('../gcp', () => ({
  getMonitoringClient: () => ({ listTimeSeries: jest.fn() }),
  projectId: 'test-project',
}))

// Mock next/cache unstable_cache — just call through in tests
jest.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

import {
  parseRequestCounts,
  parseLatencies,
  buildMetricsForServer,
} from '../monitoring'

function makePoint(value: number, seconds: number) {
  return {
    interval: { startTime: { seconds } },
    value: { int64Value: String(value), doubleValue: value },
  }
}

describe('parseRequestCounts', () => {
  it('sums 2xx and 5xx series into requestCount and errorCount', () => {
    const timeSeries = [
      {
        metric: { labels: { response_code_class: '2xx' } },
        points: [makePoint(80, 1000), makePoint(90, 2000)],
      },
      {
        metric: { labels: { response_code_class: '5xx' } },
        points: [makePoint(10, 1000), makePoint(5, 2000)],
      },
    ]
    const { requestCount, errorCount, errorRate } = parseRequestCounts(timeSeries as any)
    expect(requestCount).toHaveLength(2)
    expect(errorCount[0].value).toBe(10)
    expect(errorRate).toBeCloseTo(8.1, 0)
  })

  it('returns zero errorRate when no error series', () => {
    const timeSeries = [
      {
        metric: { labels: { response_code_class: '2xx' } },
        points: [makePoint(100, 1000)],
      },
    ]
    const { errorRate } = parseRequestCounts(timeSeries as any)
    expect(errorRate).toBe(0)
  })

  it('returns empty arrays when no time series data', () => {
    const { requestCount, errorCount, errorRate } = parseRequestCounts([])
    expect(requestCount).toHaveLength(0)
    expect(errorCount).toHaveLength(0)
    expect(errorRate).toBe(0)
  })
})

describe('parseLatencies', () => {
  it('extracts p50 and p99 averages from labeled series', () => {
    const series50 = [
      {
        metric: { labels: {} },
        points: [makePoint(120, 1000), makePoint(130, 2000)],
      },
    ]
    const series99 = [
      {
        metric: { labels: {} },
        points: [makePoint(400, 1000), makePoint(450, 2000)],
      },
    ]
    const { p50LatencyMs, p99LatencyMs } = parseLatencies(series50 as any, series99 as any)
    expect(p50LatencyMs).toBeCloseTo(125)
    expect(p99LatencyMs).toBeCloseTo(425)
  })

  it('returns 0 when no latency data', () => {
    const { p50LatencyMs, p99LatencyMs } = parseLatencies([], [])
    expect(p50LatencyMs).toBe(0)
    expect(p99LatencyMs).toBe(0)
  })
})

describe('buildMetricsForServer', () => {
  it('assembles ServerMetrics from parsed series', () => {
    const countSeries = [
      {
        metric: { labels: { response_code_class: '2xx' } },
        points: [makePoint(100, 1000)],
      },
    ]
    const result = buildMetricsForServer([], [], [], 'gong')
    expect(result.serverId).toBe('gong')
    expect(result.requestCount).toHaveLength(0)
    expect(result.errorRate).toBe(0)
  })
})
