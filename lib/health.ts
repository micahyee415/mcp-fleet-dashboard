// lib/health.ts
import type { McpServer, HealthResult } from './types'
import { MCP_SERVERS } from './servers'

const HEALTH_TIMEOUT_MS = 5000

export async function checkHealth(server: McpServer): Promise<HealthResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  const start = Date.now()

  try {
    const response = await fetch(server.healthUrl, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)

    if (!response.ok) {
      return {
        serverId: server.id,
        status: 'down',
        latencyMs: null,
        checkedAt: new Date().toISOString(),
        error: `HTTP ${response.status}`,
      }
    }

    return {
      serverId: server.id,
      status: 'up',
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    }
  } catch (err) {
    clearTimeout(timer)
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Health check timed out after ${HEALTH_TIMEOUT_MS}ms`
          : err.message
        : 'Unknown error'

    return {
      serverId: server.id,
      status: 'down',
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: message,
    }
  }
}

export async function checkAllHealth(): Promise<HealthResult[]> {
  const results = await Promise.allSettled(
    MCP_SERVERS.map((server) => checkHealth(server))
  )

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value
    return {
      serverId: MCP_SERVERS[i].id,
      status: 'down' as const,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: result.reason?.message ?? 'Unknown error',
    }
  })
}
