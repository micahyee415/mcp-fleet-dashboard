# mcp-dashboard

> A Next.js dashboard that monitors the health and status of a fleet of MCP (Model Context Protocol) servers deployed on Google Cloud Run.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Auth.js](https://img.shields.io/badge/Auth.js-v5-purple)

## Overview

`mcp-dashboard` is a real-time operations dashboard for teams running multiple MCP servers on Google Cloud Run. It aggregates three data pipelines — live `/health` endpoint polling, GCP Cloud Monitoring metrics, and GCP Cloud Logging audit trails — into a single authenticated UI. The server list is a single array in `lib/servers.ts`; adding a new server requires one entry and nothing else changes.

## Features

- **Live health polling** — pings each server's `/health` endpoint with a 5-second timeout; displays status (`up` / `degraded` / `down`), response latency, and last-checked time per server.
- **Fleet-wide status grid** — card-per-server layout with colour-coded status pills and response times, filterable to a single server.
- **Usage & performance metrics** — pulls `run.googleapis.com/request_count` and `run.googleapis.com/request_latencies` from GCP Cloud Monitoring; shows total requests, error count, error rate, p50 and p99 latency in a sortable table plus bar/line charts via Recharts.
- **Selectable time ranges** — 1h, 6h, 24h (default), and 7d windows; cache TTL scales with the window (5min → 1hr) to avoid unnecessary GCP quota usage.
- **Audit log table** — queries GCP Cloud Logging for structured `jsonPayload` entries (user, tool, duration, status code) across all servers or a single server, up to 100 most-recent entries, always fetched fresh (no caching on security data).
- **Security highlights panel** — automatically surfaces auth failures (401/403), write operations, rate-limit hits (429), error spikes (>5% 5xx), and slow requests (>30s), grouped by server and user.
- **Per-server filtering** — server-toggle bar lets you scope all three sections to one server or view the full fleet at once.
- **Manual refresh** — POST to `/api/refresh` triggers `revalidatePath` to bust the Next.js data cache on demand; rate-limited to 10/min per user.
- **Google OAuth (domain-restricted)** — Auth.js v5 with Google provider; `signIn` callback enforces `@example.com` domain at login time, all API routes require an active session.
- **Per-user rate limiting** — in-memory limiter (60 req/min on data endpoints, 10/min on manual refresh) prevents accidental GCP quota exhaustion.
- **REST transport on Vercel** — GCP SDK clients (`MetricServiceClient`, `Logging`) are forced to `fallback: 'rest'`; the default gRPC/HTTP-2 transport fails silently on Vercel serverless.
- **Dependency security** — Dependabot weekly scanning, CodeQL on PRs, `npm audit` in CI; overrides in `package.json` pin transitive deps to patched versions.
- **20 Jest unit tests** — cover health-check logic, log parsing, and metrics aggregation.

## Screenshots

> _Add screenshot here before publishing._

## Architecture

```
Browser
  └─ Next.js App Router (app/)
       ├─ app/page.tsx          — server component; fetches all three pipelines in parallel on load
       ├─ app/api/health/       — GET: polls all server /health endpoints
       ├─ app/api/metrics/      — GET: GCP Cloud Monitoring (request_count, latencies)
       ├─ app/api/audit/        — GET: GCP Cloud Logging (structured jsonPayload entries)
       └─ app/api/refresh/      — POST: busts Next.js cache via revalidatePath

lib/
  ├─ servers.ts      — single source of truth: array of { id, label, service, healthUrl }
  ├─ health.ts       — checkHealth() / checkAllHealth() with AbortController timeout
  ├─ monitoring.ts   — GCP Cloud Monitoring queries; unstable_cache with range-scaled TTL
  ├─ logging.ts      — GCP Cloud Logging queries; parseLogEntry(); deriveSecurityHighlights()
  ├─ gcp.ts          — lazy singleton GCP clients (REST transport for Vercel compatibility)
  ├─ rate-limit.ts   — in-memory per-user rate limiter
  └─ types.ts        — shared TypeScript interfaces

components/
  ├─ Dashboard.tsx       — client component; owns all state, fan-out fetches on filter/range change
  ├─ StatusBar.tsx       — per-server health cards
  ├─ MetricsSection.tsx  — summary table + bar chart (request volume) + line chart (latency)
  ├─ AuditSection.tsx    — recent-activity table + security highlights panel
  ├─ ServerToggle.tsx    — server/range filter bar
  └─ RefreshButton.tsx   — manual cache-bust trigger
```

**Data flow on page load:** The root server component fires three `Promise.all` calls — health checks, Cloud Monitoring queries (themselves parallelized per server across request_count/p50/p99), and Cloud Logging queries — before streaming HTML to the client. Subsequent filter and range changes are handled client-side by `Dashboard.tsx` calling the API routes directly.

**Adding a server:** Add one object to `MCP_SERVERS` in `lib/servers.ts`. The health, metrics, and audit pipelines pick it up automatically.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Auth | Auth.js v5 (next-auth) + Google OAuth |
| Charts | Recharts 3 |
| GCP SDK | @google-cloud/monitoring, @google-cloud/logging |
| Date formatting | date-fns 4 |
| Testing | Jest 29 + ts-jest |
| CI | GitHub Actions (CodeQL, npm audit) |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Cloud project with Cloud Run services, Cloud Monitoring, and Cloud Logging enabled
- A GCP service account with read-only roles:
  - `roles/monitoring.viewer`
  - `roles/logging.viewer`
- A Google OAuth app (for Auth.js)

### Installation

```bash
git clone https://github.com/micahyee415/mcp-fleet-dashboard
cd mcp-fleet-dashboard
npm install
```

### Configuration

Copy or create a `.env.local` file with the following variables:

```env
# Auth.js — Google OAuth credentials
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
AUTH_SECRET=your-random-32-char-secret   # generate: openssl rand -base64 32

# GCP — service account key as a single-line JSON string
GCP_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"..."}
GCP_PROJECT_ID=your-gcp-project
```

**Restrict login to your domain:** In `auth.config.ts`, update the `signIn` callback to check your email domain:

```ts
signIn({ profile }) {
  return (profile?.email ?? '').endsWith('@your-company.com')
},
```

**Add your servers:** Edit `lib/servers.ts` — add one entry per Cloud Run service:

```ts
{
  id: 'my-service',
  label: 'My Service',
  service: 'my-service-cloud-run-name',   // Cloud Run service name
  healthUrl: 'https://my-service.example.com/health',
}
```

### Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to Google sign-in.

### Run tests

```bash
npm test
```

### Build

```bash
npm run build
npm start
```

### Deploy to Vercel

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add the four environment variables above in **Project → Settings → Environment Variables**.
3. Deploy. Vercel's serverless environment is supported — the GCP SDK clients use REST transport automatically.

> **Note:** After each `vercel --prod` deploy, confirm the app loads and the `/api/health` route returns data. The `fallback: 'rest'` option in `lib/gcp.ts` is required; without it, gRPC transport fails silently in serverless environments.
