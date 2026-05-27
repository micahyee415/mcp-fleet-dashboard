# Changelog

## [1.1.5] - 2026-05-27

### Fixed

- **Restore metrics + audit data on Vercel (gRPC→REST).** The Cloud Monitoring (`MetricServiceClient`) and Cloud Logging (`Logging`) clients in `lib/gcp.ts` now pass `fallback: 'rest'`, forcing HTTPS/1.1 REST transport. The default gRPC/HTTP-2 transport fails silently on Vercel serverless (empty-status rejections), causing every `listTimeSeries`/`getEntries` call to reject — `Promise.allSettled` swallowed the errors and the dashboard rendered "No metrics data" / "No activity" even though GCP held the data. Status/health polling was unaffected because it uses plain HTTP, not the GCP SDK.
- Removed the `protobufjs: ^7.5.8` override from `package.json` — it broke gRPC bundling under Turbopack; `protobufjs@7.5.8` still resolves transitively via `google-gax`, and `npm audit` remains clean.

### Removed

- Remove `salesforce-write` from monitored servers — the write service was decommissioned (unauditable, zero write calls in 90 days). Relabeled the remaining read entry `Salesforce`.

### Added

- Add Google Slides MCP server to the monitored fleet.
- Add Vitally MCP server to the monitored fleet.

## [1.1.4] - 2026-05-12

### Security

- Resolve 3 new transitive npm advisories (1 moderate, 2 high) surfaced by weekly audit:
  - `next` bumped `16.2.3` → `16.2.6` (13 CVEs including middleware/proxy bypasses, cache poisoning, CSP nonce XSS, SSRF, DoS — GHSA-492v-c6pp-mqqv, GHSA-wfc6-r584-vfw7, GHSA-c4j6-fc7j-m34r, GHSA-ffhc-5mcf-pf4q, and others)
  - Added `protobufjs → ^7.5.8` override (7 CVEs including overlong UTF-8 decoding, prototype injection, code injection via bytes field defaults — GHSA-q6x5-8v7m-xcrf, GHSA-fx83-v9x8-x52w, GHSA-66ff-xgx4-vchm, and others)
  - `@protobufjs/utf8` resolves to `1.1.1` transitively, clearing GHSA-q6x5-8v7m-xcrf
- Stayed within same major versions (no `npm audit fix --force`) to avoid regressions

### Verified

- `npm audit` clean (0 vulnerabilities)
- `npm run build` passes (Next 16.2.6 + Turbopack)
- All 20 Jest tests pass

## [1.1.3] - 2026-04-27

### Security

- Resolve all 13 transitive npm advisories (2 low, 11 moderate) by adding `overrides` in `package.json`:
  - `@tootallnate/once` → `^3.0.1` (GHSA-vpq2-c234-7xj6)
  - `http-proxy-agent` → `^7.0.0`
  - `teeny-request` → `^10.1.2`
  - `uuid` → `^14.0.0` (GHSA-w5hq-g745-h8pq)
  - `postcss` → `^8.5.12` (GHSA-qx2v-qp2m-jg93)
- Avoided `npm audit fix --force` — would have downgraded `next` 16 → 9 and `@google-cloud/logging` 11 → 9.5

### Verified

- `npm audit` clean (0 vulnerabilities)
- `npm run build` passes (Next 16.2.3 + Turbopack)
- All 20 Jest tests pass

## [1.1.2] - 2026-04-20

### Security

- Updated `@google-cloud/logging` dependencies to reduce transitive vulnerability surface.

## [1.1.1] - 2026-04-16

### Removed

- Delete dead `proxy.ts` middleware file — was never loaded by Next.js (must be named `middleware.ts`); auth is enforced at the route/page level on every endpoint.
- Remove unused `signIn`/`signOut` exports from `auth.ts`.
- Remove `jest-environment-node` devDependency — bundled inside Jest 29, no longer needed as an explicit dep.

## [1.1.0] - 2026-04-16

### Security

- Remove debug endpoint (`/api/debug/logs`) that exposed raw GCP log structure.
- Sanitize error responses in the metrics API — no longer leaks GCP SDK internals (service account emails, project IDs).
- Add per-user rate limiting (60 req/min) on all API endpoints to prevent GCP quota exhaustion.

### Fixed

- Security highlights (`auth_failure`, `write_op`) now group by server+user instead of using the first entry's `serverId` — fixes incorrect attribution when log entries span multiple servers.
- Fix pre-existing test bug: logging test provided `fields.tool` but parser reads `fields.message`.

### Improved

- Parallelize 3 sequential GCP Monitoring queries (request_count, p50, p99) via `Promise.all` — ~3x faster metrics fetch.
- Scale cache TTL to time range: 5min (1h), 15min (6h), 30min (24h), 1hr (7d) instead of a static 1hr for all ranges.
- Remove dead Proxy exports from `lib/gcp.ts`; update test mocks to use `getMonitoringClient`/`getLoggingClient` directly.

## [1.0.0] - 2026-04-15

### Added

- Initial release: health, usage, and audit monitoring for a fleet of GCP Cloud Run MCP servers.
- Google OAuth (domain-restricted) via Auth.js v5.
- Cloud Monitoring + Cloud Logging + `/health` endpoint pipelines.
- Per-server toggle with consistent three-section layout (Status / Usage & Performance / Audit & Security).
- Hourly cache with on-demand manual refresh.
