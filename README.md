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
