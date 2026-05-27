# Security Policy

## Overview

This is an internal dashboard for monitoring GCP MCP servers at Example Corp. It is restricted to `@example.com` Google accounts via OAuth and is deployed on Vercel.

## Reporting a Vulnerability

Please report security vulnerabilities privately through GitHub:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability** to open a private advisory.

This keeps the report confidential until a fix is released. Please don't open a public issue for security vulnerabilities.

## Security Controls

### Authentication & Authorization
- Google OAuth via Auth.js v5, restricted to `@example.com` accounts
- All API endpoints require an active session — unauthenticated requests return 401
- Per-user rate limiting (60 req/min on data endpoints, 10/min on manual refresh)

### Data Protection
- Dashboard reads from GCP Cloud Monitoring and Cloud Logging via a least-privilege service account
- Service account credentials are stored in Vercel environment variables (never in source code)
- All traffic over HTTPS (Vercel enforces TLS)
- No user data is persisted by the dashboard itself

### Secrets Management
- No secrets in source code or committed files
- Credentials stored in Vercel project environment variables
- Service account: `mcp-dashboard@your-gcp-project.iam.gserviceaccount.com` (read-only GCP roles)

### Dependency Security
- Automated dependency scanning via Dependabot (weekly)
- CodeQL analysis on all pull requests
- `npm audit` run in CI on every PR

## Incident Response

In the event of a security incident involving this dashboard:

1. **Contain:** Disable the Vercel deployment and/or rotate the GCP service account key immediately
2. **Investigate:** Review GCP Cloud Logging for unauthorized access patterns
3. **Notify:** Alert the repository maintainers if data exposure is suspected
4. **Remediate:** Patch, redeploy, and rotate credentials
5. **Document:** Record timeline and actions in the IT incident log

## SOC 2 Alignment

This dashboard is operated within Example Corp's SOC 2 Type II environment:
- Access is restricted to verified `@example.com` employees
- Audit logging is enabled at the GCP layer
- Changes require code review and pass CI security checks before deployment
- Dependency vulnerabilities are automatically surfaced via Dependabot
