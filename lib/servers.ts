// lib/servers.ts
import type { McpServer } from './types'

export const MCP_SERVERS: McpServer[] = [
  {
    id: 'gong',
    label: 'Gong',
    service: 'gong-mcp-server',
    healthUrl: 'https://your-service.example.com/health',
  },
  {
    id: 'upflow',
    label: 'Upflow',
    service: 'upflow-mcp',
    healthUrl: 'https://your-service.example.com/health',
  },
  {
    id: 'salesforce-read',
    label: 'Salesforce',
    service: 'salesforce-mcp',
    healthUrl: 'https://your-service.example.com/health',
  },
  // salesforce-write removed 2026-05-26 — write service decommissioned (unauditable, zero write calls in 90d).
  {
    id: 'github',
    label: 'GitHub',
    service: 'github-mcp',
    healthUrl: 'https://your-service.example.com/health',
  },
  {
    id: 'gsheets',
    label: 'Google Sheets',
    service: 'gsheets-mcp',
    healthUrl: 'https://your-service.example.com/health',
  },
  {
    id: 'google-slides',
    label: 'Google Slides',
    service: 'google-slides-mcp',
    healthUrl: 'https://your-service.example.com/health',
  },
  {
    id: 'vitally',
    label: 'Vitally',
    service: 'vitally-mcp',
    healthUrl: 'https://your-service.example.com/health',
  },
]

// Adding a new server: add one entry above. Nothing else changes.

export function getServer(id: string): McpServer | undefined {
  return MCP_SERVERS.find((s) => s.id === id)
}
