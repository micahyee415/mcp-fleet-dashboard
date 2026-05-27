// lib/gcp.ts
import { MetricServiceClient } from '@google-cloud/monitoring'
import { Logging } from '@google-cloud/logging'

function getCredentials() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GCP_SERVICE_ACCOUNT_KEY is not set')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('GCP_SERVICE_ACCOUNT_KEY is not valid JSON')
  }
}

export const projectId = process.env.GCP_PROJECT_ID ?? 'your-gcp-project'

// Lazy singletons — initialised on first use so the module can be imported
// at build time without requiring GCP credentials in the environment.
let _monitoringClient: MetricServiceClient | null = null
let _loggingClient: Logging | null = null

export function getMonitoringClient(): MetricServiceClient {
  if (!_monitoringClient) {
    const credentials = getCredentials()
    // fallback: 'rest' forces HTTPS/1.1 REST transport. The default gRPC/HTTP-2
    // transport fails on Vercel serverless (empty-status rejections), leaving the
    // dashboard with no metrics/audit data. See CHANGELOG v1.1.5 / memory_mcp_dashboard.
    _monitoringClient = new MetricServiceClient({ credentials, projectId, fallback: 'rest' })
  }
  return _monitoringClient
}

export function getLoggingClient(): Logging {
  if (!_loggingClient) {
    const credentials = getCredentials()
    // fallback: 'rest' is a valid google-gax runtime option (same REST-transport
    // fix as the monitoring client above) but isn't declared on LoggingOptions' TS
    // type. Pass via a variable so excess-property checking doesn't reject it.
    const loggingOptions = { credentials, projectId, fallback: 'rest' as const }
    _loggingClient = new Logging(loggingOptions)
  }
  return _loggingClient
}

