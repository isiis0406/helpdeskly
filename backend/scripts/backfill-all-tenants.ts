/*
  Run a SQL backfill across all tenant databases.
  - Lists tenants from Control DB
  - For each tenant, executes provided SQL (single string) or a SQL file

  Usage examples:
    CONTROL_DATABASE_URL=postgres://... \
    DATABASE_URL=postgres://.../postgres \
    pnpm -C backend ts-node scripts/backfill-all-tenants.ts --sql "UPDATE tickets SET ... WHERE ...;"

    CONTROL_DATABASE_URL=postgres://... \
    DATABASE_URL=postgres://.../postgres \
    pnpm -C backend ts-node scripts/backfill-all-tenants.ts --sql-file ./sql/backfill_ticket_number.sql
*/

import { PrismaClient as ControlPrismaClient } from ".prisma/control";
import { PrismaClient as TenantPrismaClient } from ".prisma/tenant";
import * as fs from "fs";
import * as path from "path";

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

function getArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  const kv = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (kv) return kv.split("=", 2)[1];
  return undefined;
}

async function main() {
  loadEnvIfPresent(path.resolve(__dirname, "../.env"));

  const sqlArg = getArg("sql");
  const sqlFile = getArg("sql-file");
  if (!sqlArg && !sqlFile) {
    throw new Error("Provide --sql \"...\" or --sql-file <path>");
  }
  const sql = sqlArg || fs.readFileSync(path.resolve(sqlFile!), "utf8");
  if (!sql.trim()) throw new Error("SQL is empty");

  const controlUrl = process.env.CONTROL_DATABASE_URL;
  if (!controlUrl) throw new Error("CONTROL_DATABASE_URL is required");

  const control = new ControlPrismaClient();
  await control.$connect();
  try {
    const tenants = await control.tenant.findMany({
      where: { status: { in: ["ACTIVE", "PROVISIONING"] } },
      select: { id: true, slug: true, dbUrl: true },
    });
    if (tenants.length === 0) {
      console.log("ℹ️  No tenants to backfill");
      return;
    }
    const base = process.env.DATABASE_URL || "";

    console.log(`🧩 Running backfill on ${tenants.length} tenants...`);
    let ok = 0, fail = 0;
    for (const t of tenants) {
      const url = t.dbUrl || (base ? base.replace(/\/[^/]+$/, `/${t.slug}_db`) : "");
      if (!url) {
        console.warn(`⚠️  Skip ${t.slug}: no dbUrl and no DATABASE_URL base`);
        continue;
      }
      process.stdout.write(`  ➤ ${t.slug} ... `);
      const tenant = new TenantPrismaClient({ datasources: { db: { url } } });
      try {
        await tenant.$executeRawUnsafe(sql);
        console.log("done");
        ok++;
      } catch (e) {
        console.log("failed");
        console.error(`     ❌ ${t.slug}:`, e);
        fail++;
      } finally {
        await tenant.$disconnect();
      }
    }
    console.log(`✅ Completed. Success: ${ok}, Failed: ${fail}, Total: ${tenants.length}`);
  } finally {
    await control.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Backfill failed:", e);
  process.exit(1);
});

