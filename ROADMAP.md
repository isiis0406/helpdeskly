# Helpdeskly Roadmap

Status: draft
Owner: core team

## Themes

- Core Tickets: numbering, tags, custom statuses, linking/duplicate, SLA
- Collaboration: mentions, notifications (in‑app/email/webhook), smart assignment
- Personalization: custom fields per tenant, forms, branding
- Integrations: email inbound/outbound, webhooks signés, API keys, Zapier/Make
- Files: S3/MinIO storage, signed URLs, antivirus, quotas
- Search: Postgres full‑text per tenant, faceted filters
- Analytics: dashboards, trends, CSV export, usage metrics
- Billing: upgrade/downgrade, proration, dunning, plan/quota limits
- Admin: roles/permissions fine‑grained, audit logs, tenant settings
- Reliability: safe migrations, monitoring, alerting, backups, CI/CD

## Production Readiness (Baseline)

- Security: 2FA, JWT/refresh rotation, rate‑limit per tenant, CORS/Helmet
- Multi‑tenant: strict scoping, DB isolation, PgBouncer pool limits
- Observability: structured logs, traces, Prometheus metrics, Sentry
- Data: daily backups (Control + tenants), tested restore, retention policy
- CI/CD: typecheck, tests, lint, migrations check, Docker build, blue/green deploy

## Sprint 1 — Professionalization

- Ticket numbering via DB sequence per tenant
  - Goal: atomic, collision‑free numbering (`T-000001`)
  - Tasks: SQL migration (sequence + default), service update to rely on DB
  - Status: planned

- Notifications & Webhooks (assignee/author)
  - Goal: notify on create/comment/assign; signed webhooks per tenant
  - Tasks: event table (tenant), dispatcher worker, Control config for webhook endpoints + HMAC
  - Status: planned

- API Keys per tenant
  - Goal: stable external integrations
  - Tasks: Control `api_keys` with scopes, middleware, rate‑limit + audit
  - Status: planned

- Observability baseline
  - Goal: health checks, metrics, error tracking
  - Tasks: `/health`, Prometheus counters/histograms, Sentry wiring
  - Status: planned

## Notes

- Migrations: follow Expand → Backfill → Contract. Use `db:deploy:tenants` and `backfill:tenants`.
- UI: adopt Tailwind palette (brand colors provided) and build reusable components.

