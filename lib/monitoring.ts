// lib/monitoring.ts
import { unstable_cache } from 'next/cache'
import { getMonitoringClient, projectId } from './gcp'
import type { ServerMetrics, TimeSeriesPoint, TimeRange } from './types'

const ALIGNMENT: Record<TimeRange, number> = {
  '1h': 300,
  '6h': 1800,
  '24h': 3600,
  '7d': 21600,
}

function rangeToStartTime(range: TimeRange): Date {
  const seconds = { '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800 }
  return new Date(Date.now() - seconds[range] * 1000)
}

type RawTimeSeries = {
  metric: { labels: Record<string, string> }
  points: { interval: { startTime: { seconds: number } }; value: { int64Value?: string; doubleValue?: number } }[]
}

export function parseRequestCounts(timeSeries: RawTimeSeries[]): {
  requestCount: TimeSeriesPoint[]
  errorCount: TimeSeriesPoint[]
  errorRate: number
} {
  const byClass: Record<string, Map<number, number>> = {}

  for (const series of timeSeries) {
    const cls = series.metric.labels['response_code_class'] ?? 'unknown'
    byClass[cls] ??= new Map()
    for (const pt of series.points) {
      const ts = pt.interval.startTime.seconds
      const val = Number(pt.value.int64Value ?? pt.value.doubleValue ?? 0)
      byClass[cls].set(ts, (byClass[cls].get(ts) ?? 0) + val)
    }
  }

  const allTs = new Set<number>()
  for (const m of Object.values(byClass)) for (const k of m.keys()) allTs.add(k)
  const timestamps = Array.from(allTs).sort()

  const requestCount: TimeSeriesPoint[] = timestamps.map((ts) => ({
    timestamp: new Date(ts * 1000).toISOString(),
    value: Object.values(byClass).reduce((sum, m) => sum + (m.get(ts) ?? 0), 0),
  }))

  const errorCount: TimeSeriesPoint[] = timestamps.map((ts) => ({
    timestamp: new Date(ts * 1000).toISOString(),
    value: byClass['5xx']?.get(ts) ?? 0,
  }))

  const totalRequests = requestCount.reduce((s, p) => s + p.value, 0)
  const totalErrors = errorCount.reduce((s, p) => s + p.value, 0)
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0

  return { requestCount, errorCount, errorRate }
}

export function parseLatencies(
  p50Series: RawTimeSeries[],
  p99Series: RawTimeSeries[]
): { p50LatencyMs: number; p99LatencyMs: number } {
  const avg = (series: RawTimeSeries[]) => {
    const vals = series.flatMap((s) =>
      s.points.map((p) => Number(p.value.doubleValue ?? p.value.int64Value ?? 0))
    )
    if (vals.length === 0) return 0
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }
  return { p50LatencyMs: avg(p50Series), p99LatencyMs: avg(p99Series) }
}

export function buildMetricsForServer(
  countSeries: RawTimeSeries[],
  p50Series: RawTimeSeries[],
  p99Series: RawTimeSeries[],
  serverId: string
): ServerMetrics {
  const { requestCount, errorCount, errorRate } = parseRequestCounts(countSeries)
  const { p50LatencyMs, p99LatencyMs } = parseLatencies(p50Series, p99Series)
  return { serverId, requestCount, errorCount, errorRate, p50LatencyMs, p99LatencyMs }
}

async function fetchMetricsForService(
  service: string,
  range: TimeRange
): Promise<{ countSeries: RawTimeSeries[]; p50Series: RawTimeSeries[]; p99Series: RawTimeSeries[] }> {
  const end = new Date()
  const start = rangeToStartTime(range)
  const alignmentPeriod = { seconds: ALIGNMENT[range] }
  const interval = {
    startTime: { seconds: Math.floor(start.getTime() / 1000), nanos: 0 },
    endTime: { seconds: Math.floor(end.getTime() / 1000), nanos: 0 },
  }
  const resourceFilter = `resource.labels.service_name="${service}"`

  const client = getMonitoringClient()
  const [countResult, p50Result, p99Result] = await Promise.all([
    client.listTimeSeries({
      name: `projects/${projectId}`,
      filter: `metric.type="run.googleapis.com/request_count" AND ${resourceFilter}`,
      interval,
      aggregation: {
        alignmentPeriod,
        perSeriesAligner: 'ALIGN_SUM',
        crossSeriesReducer: 'REDUCE_SUM',
        groupByFields: ['metric.labels.response_code_class'],
      },
      view: 'FULL',
    }),
    client.listTimeSeries({
      name: `projects/${projectId}`,
      filter: `metric.type="run.googleapis.com/request_latencies" AND ${resourceFilter}`,
      interval,
      aggregation: {
        alignmentPeriod,
        perSeriesAligner: 'ALIGN_PERCENTILE_50',
        crossSeriesReducer: 'REDUCE_MEAN',
      },
      view: 'FULL',
    }),
    client.listTimeSeries({
      name: `projects/${projectId}`,
      filter: `metric.type="run.googleapis.com/request_latencies" AND ${resourceFilter}`,
      interval,
      aggregation: {
        alignmentPeriod,
        perSeriesAligner: 'ALIGN_PERCENTILE_99',
        crossSeriesReducer: 'REDUCE_MEAN',
      },
      view: 'FULL',
    }),
  ])

  return {
    countSeries: countResult[0] as unknown as RawTimeSeries[],
    p50Series: p50Result[0] as unknown as RawTimeSeries[],
    p99Series: p99Result[0] as unknown as RawTimeSeries[],
  }
}

const CACHE_TTL: Record<TimeRange, number> = {
  '1h': 300,
  '6h': 900,
  '24h': 1800,
  '7d': 3600,
}

const cachedFetchers = Object.fromEntries(
  (['1h', '6h', '24h', '7d'] as TimeRange[]).map((range) => [
    range,
    unstable_cache(
      async (service: string, serverId: string): Promise<ServerMetrics> => {
        const { countSeries, p50Series, p99Series } = await fetchMetricsForService(service, range)
        return buildMetricsForServer(countSeries, p50Series, p99Series, serverId)
      },
      ['metrics', range],
      { tags: ['metrics'], revalidate: CACHE_TTL[range] }
    ),
  ])
) as Record<TimeRange, (service: string, serverId: string) => Promise<ServerMetrics>>

export async function getMetrics(service: string, range: TimeRange, serverId: string): Promise<ServerMetrics> {
  return cachedFetchers[range](service, serverId)
}
