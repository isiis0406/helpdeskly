/*
  One-off fixer for tenant migration 20250907204209_add_ticket_number
  - Backfills ticketNumber for existing tickets, creates usage_events if missing
  - Marks the migration as applied to avoid checksum errors

  Usage examples:
    # Resolve by tenant slug (uses Control DB to find URL or derive from DATABASE_URL)
    CONTROL_DATABASE_URL=postgres://... \
    DATABASE_URL=postgres://.../postgres \
    pnpm -C backend ts-node scripts/fix-tenant-migration.ts --slug isiisorg2

    # Or provide tenant DB URL directly
    pnpm -C backend TENANT_DB_URL=postgres://.../isiisorg2_db ts-node scripts/fix-tenant-migration.ts
*/

import { PrismaClient as ControlPrismaClient } from ".prisma/control";
import { PrismaClient as TenantPrismaClient } from ".prisma/tenant";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

function loadEnvIfPresent(file: string) {
  try {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

function argValue(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  const kv = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (kv) return kv.split("=", 2)[1];
  return undefined;
}

async function resolveTenantDbUrl(): Promise<{ url: string; slug?: string }> {
  const direct = process.env.TENANT_DB_URL;
  if (direct) return { url: direct };

  const slug = argValue("slug") || process.env.TENANT_SLUG;
  if (!slug)
    throw new Error("Provide --slug <tenantSlug> or TENANT_DB_URL env");

  const controlUrl = process.env.CONTROL_DATABASE_URL;
  if (!controlUrl)
    throw new Error(
      "CONTROL_DATABASE_URL is required to resolve tenant by slug"
    );

  const control = new ControlPrismaClient();
  await control.$connect();
  try {
    const t = await control.tenant.findUnique({
      where: { slug },
      select: { dbUrl: true, slug: true },
    });
    if (!t) throw new Error(`Tenant not found in Control DB: ${slug}`);
    let url = t.dbUrl || "";
    if (!url) {
      const base = process.env.DATABASE_URL || "";
      if (!base)
        throw new Error(
          "DATABASE_URL base is required to derive tenant DB URL"
        );
      url = base.replace(/\/[^/]+$/, `/${slug}_db`);
    }
    return { url, slug };
  } finally {
    await control.$disconnect();
  }
}

async function run() {
  loadEnvIfPresent(path.resolve(__dirname, "../.env"));

  const { url, slug } = await resolveTenantDbUrl();
  const tenant = new TenantPrismaClient({ datasources: { db: { url } } });
  await tenant.$connect();
  try {
    console.log(`🔧 Fixing tenant ${slug || url} ...`);

    // Create enums if missing
    await tenant.$executeRawUnsafe(`DO $$ BEGIN
      CREATE TYPE "UsageEventType" AS ENUM ('CREATE','UPDATE','DELETE','VIEW','EXPORT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await tenant.$executeRawUnsafe(`DO $$ BEGIN
      CREATE TYPE "EntityType" AS ENUM ('TICKET','COMMENT','USER','ATTACHMENT','API_CALL');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    // Add column, backfill, enforce constraints
    await tenant.$executeRawUnsafe(
      `ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "ticketNumber" TEXT;`
    );

    await tenant.$executeRawUnsafe(`WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
      FROM "tickets"
    )
    UPDATE "tickets" t
    SET "ticketNumber" = LPAD(o.rn::text, 6, '0')
    FROM ordered o
    WHERE t.id = o.id AND t."ticketNumber" IS NULL;`);

    await tenant.$executeRawUnsafe(
      `ALTER TABLE "tickets" ALTER COLUMN "ticketNumber" SET NOT NULL;`
    );
    await tenant.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "tickets_ticketNumber_key" ON "tickets"("ticketNumber");`
    );

    // Create usage_events table + FKs if missing
    await tenant.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "usage_events" (
      "id" TEXT NOT NULL,
      "eventType" "UsageEventType" NOT NULL,
      "entityType" "EntityType" NOT NULL,
      "entityId" TEXT NOT NULL,
      "incrementValue" INTEGER NOT NULL DEFAULT 1,
      "userId" TEXT NOT NULL,
      "ticketId" TEXT,
      "commentId" TEXT,
      "syncedToControl" BOOLEAN NOT NULL DEFAULT false,
      "syncedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
    );`);

    await tenant.$executeRawUnsafe(`DO $$ BEGIN
      ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    await tenant.$executeRawUnsafe(`DO $$ BEGIN
      ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    console.log("✅ Schema fixed. Marking migration as applied...");

    // Mark the migration as applied so future deploys don't try to re-run it
    const tenantSchemaPath = path.resolve(
      __dirname,
      "../prisma/tenant/schema.prisma"
    );
    const projectRoot = path.resolve(__dirname, "..");
    await execAsync(
      `npx prisma migrate resolve --schema="${tenantSchemaPath}" --applied 20250907204209_add_ticket_number`,
      {
        cwd: projectRoot,
        env: { ...process.env, DATABASE_URL: url },
        timeout: 120000,
      }
    );

    console.log("🎉 Migration marked as applied.");
  } finally {
    await tenant.$disconnect();
  }
}

run().catch((e) => {
  console.error("❌ Fix failed:", e);
  process.exit(1);
});
