// lib/__tests__/health.test.ts
import { checkHealth, checkAllHealth } from '../health'
import { MCP_SERVERS } from '../servers'

// Mock global fetch
global.fetch = jest.fn()

describe('checkHealth', () => {
  const server = MCP_SERVERS[0] // Gong

  beforeEach(() => jest.clearAllMocks())

  it('returns up when /health responds 200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 })
    const result = await checkHealth(server)
    expect(result.status).toBe('up')
    expect(result.serverId).toBe('gong')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
  })

  it('returns down when /health responds non-200', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 })
    const result = await checkHealth(server)
    expect(result.status).toBe('down')
    expect(result.latencyMs).toBeNull()
  })

  it('returns down when fetch throws (network error)', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    const result = await checkHealth(server)
    expect(result.status).toBe('down')
    expect(result.error).toContain('Network error')
    expect(result.latencyMs).toBeNull()
  })

  it('returns down when fetch times out', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    )
    const result = await checkHealth(server)
    expect(result.status).toBe('down')
    expect(result.error).toContain('timed out')
  })
})

describe('checkAllHealth', () => {
  it('returns one result per server', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 })
    const results = await checkAllHealth()
    expect(results).toHaveLength(MCP_SERVERS.length)
  })

  it('isolates failures — one down server does not block others', async () => {
    let call = 0
    ;(global.fetch as jest.Mock).mockImplementation(() => {
      call++
      if (call === 1) return Promise.reject(new Error('down'))
      return Promise.resolve({ ok: true, status: 200 })
    })
    const results = await checkAllHealth()
    expect(results.filter((r) => r.status === 'up')).toHaveLength(MCP_SERVERS.length - 1)
    expect(results.filter((r) => r.status === 'down')).toHaveLength(1)
  })
})
