# HelpDeskly – Skeleton

This repo skeleton contains:

- **docker-compose.yml** – Local stack: Postgres 16, PgBouncer, Redis 7.
- **prisma/control/schema.prisma** – Schema for the control (master) database holding tenants metadata.
- **prisma/tenant/schema.prisma** – Schema for each tenant database (tickets, comments, users).

Quick start:

```bash
# 0. Clone repo
docker compose up -d
# 1. Install deps
pnpm install
# 2. Generate Prisma clients
pnpm exec prisma generate --schema=prisma/tenant/schema.prisma
pnpm exec prisma generate --schema=prisma/control/schema.prisma
```

Billing/Stripe Setup:

- Add to your environment (e.g., `.env`):
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
- Webhook endpoint (Control API): `POST /webhooks/stripe`
  - Dev: `stripe listen --forward-to localhost:${CONTROL_PORT:-6500}/webhooks/stripe`
- Plans and price IDs live in `apps/control-api/src/billing/config/plans.config.ts`.
## Seeding & Prisma (Dev shortcuts)

From this folder (`backend/`), run:

- Generate Prisma clients
  - `pnpm prisma:generate:control`
  - `pnpm prisma:generate:tenant`
  - `pnpm prisma:generate:all`

- Seed Control (plans + test tenant + demo users)
  - `pnpm db:seed:control`

- Seed current tenant database (uses `DATABASE_URL`)
  - `pnpm db:seed:tenant`
  - Force light reset: `SEED_TENANT_FORCE=1 pnpm db:seed:tenant`

- Seed everything
  - `pnpm db:seed:all`

Env vars:
- `CONTROL_DATABASE_URL` (Control DB)
- `DATABASE_URL` (cluster base; e.g. .../postgres)
- `SEED_TEST_TENANT_SLUG` / `SEED_TEST_TENANT_NAME` (optional)
- `SEED_PRUNE_PLANS` = `disable` | `delete` (optional)
- `SEED_TENANT_FORCE` = `1` (optional)

## Seeds Overview (What happens)

- Control DB orchestrator: `prisma/control/seed.ts`
  - Upserts plans from `apps/control-api/src/billing/config/plans.config.ts` (DB `plan.id` matches config `id`).
  - Optional prune of plans not in config (see “Prune Logic”).
  - Ensures/provisions a dev tenant (defaults: `slug=test`, `name=Test Workspace`):
    - Creates database `<slug>_db` if missing (via Postgres admin connection from `DATABASE_URL`).
    - Applies tenant schema via `prisma migrate deploy` then fallback `prisma db push`.
    - Seeds a welcome ticket and a realistic demo dataset (tickets, comments, usage events).
  - Ensures demo users in Control and memberships for the test tenant:
    - `user_demo_author` (OWNER), `user_demo_agent` (ADMIN), password `demo1234` (hashed).

- Tenant DB orchestrator: `prisma/tenant/seed.ts`
  - Applies tenant schema (migrate deploy + fallback db push) against `DATABASE_URL`.
  - Seeds demo tickets/comments/usage. Idempotent (skips if data exists). Force reset with `SEED_TENANT_FORCE=1`.

Tip: Run from repo root using `pnpm --filter backend <script>` or `pnpm -C backend <script>`.

## Environment Variables (details)

- `CONTROL_DATABASE_URL`
  - Connection string for Control DB (Prisma schema: `prisma/control/schema.prisma`).
  - Used by Prisma client and by provisioning logic (as admin connection to the cluster).

- `DATABASE_URL`
  - Should point to your cluster base DB (dev: typically ends with `/postgres`).
  - Control seed derives tenant DB URLs as `.../<slug>_db`.
  - For running `pnpm db:seed:tenant` manually, set `DATABASE_URL` directly to the tenant DB (e.g. `.../test_db`).

- Optional seeding flags
  - `SEED_TEST_TENANT_SLUG`, `SEED_TEST_TENANT_NAME`: customize the dev tenant created by Control seed.
  - `SEED_PRUNE_PLANS`: set to `disable` (soft prune) or `delete` (hard prune) plans not present in config.
  - `SEED_TENANT_FORCE=1`: purge existing tenant data (tickets/comments/usage) before reseeding demo data.

## Prune Logic (plans)

- Source of truth: `PLANS_CONFIG` in `apps/control-api/src/billing/config/plans.config.ts`.
- At seed time we compare DB plans with config IDs:
  - `disable` (recommended): set `isActive=false` for plans absent from config. Keeps history and avoids FK issues.
  - `delete`: remove plans absent from config. Use with caution in dev only (may conflict with existing subscriptions).
- If `SEED_PRUNE_PLANS` is not set, no pruning occurs.

## Onboarding with Demo Data

- Public signup (`POST /tenants/signup`) accepts `withDemoData: boolean`.
- If true, the provisioning worker will apply default seed + demo dataset during tenant DB provisioning.
- This mirrors what Control seed does for the dev test tenant.

## Troubleshooting

- Node/ts-node quoting
  - We avoid passing `--compiler-options` JSON on the CLI to sidestep quoting differences. `tsconfig.json` already sets `module: commonjs`.

- Prisma `db push --create-db`
  - Flag is not available; Control seed creates the DB using `pg` then runs `prisma migrate deploy` with a `db push` fallback.

- `db:seed:tenant` against wrong DB
  - Ensure `DATABASE_URL` points to the intended tenant DB (e.g. `.../test_db`). If it points to `.../postgres`, schema won’t match and seeds will fail.

- Missing tables during force reset
  - Force reset in tenant seed is wrapped in try/catch; if tables do not exist yet (first run), it continues safely.
