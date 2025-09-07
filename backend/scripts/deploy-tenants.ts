/*
  Deploy Prisma migrations to all tenant databases.
  - Reads tenants from Control DB via .prisma/control
  - For each tenant, runs: prisma migrate deploy --schema prisma/tenant/schema.prisma
  - Uses tenant.dbUrl when available, otherwise derives from env DATABASE_URL + "<slug>_db"

  Usage:
    CONTROL_DATABASE_URL=postgres://... \
    DATABASE_URL=postgres://.../postgres \
    pnpm -C backend ts-node scripts/deploy-tenants.ts
*/

import { PrismaClient as ControlPrismaClient } from ".prisma/control";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

async function main() {
  // Load backend/.env if present (without external deps)
  loadEnvIfPresent(path.resolve(__dirname, "../.env"));

  // Basic validation for Control DB URL
  const controlUrl = process.env.CONTROL_DATABASE_URL || "";
  if (!controlUrl) {
    throw new Error(
      "CONTROL_DATABASE_URL is not set. Put it in backend/.env or export it before running."
    );
  }
  if (/[\u2026]/.test(controlUrl) || /%E2%80%A6/i.test(controlUrl)) {
    throw new Error(
      "CONTROL_DATABASE_URL contains an ellipsis character (…). Replace placeholders with a real host."
    );
  }

  const control = new ControlPrismaClient();
  await control.$connect();
  try {
    const tenants = await control.tenant.findMany({
      where: { status: { in: ["ACTIVE", "PROVISIONING"] } },
      select: { id: true, slug: true, dbUrl: true },
    });

    if (tenants.length === 0) {
      console.log("ℹ️  No tenants found to deploy.");
      return;
    }

    const tenantSchemaPath = path.resolve(__dirname, "../prisma/tenant/schema.prisma");
    const projectRoot = path.resolve(__dirname, "..");
    const baseUrl = process.env.DATABASE_URL || "";
    if (baseUrl && (/[\u2026]/.test(baseUrl) || /%E2%80%A6/i.test(baseUrl))) {
      throw new Error(
        "DATABASE_URL contains an ellipsis character (…). Replace placeholders with a real host."
      );
    }

    console.log(`🚀 Deploying migrations to ${tenants.length} tenants...`);

    let success = 0;
    let skipped = 0;
    for (const t of tenants) {
      const tenantDbUrl = t.dbUrl || deriveDbUrl(baseUrl, `${t.slug}_db`);
      if (!tenantDbUrl) {
        console.warn(`⚠️  Skip ${t.slug} (${t.id}) — no dbUrl and no DATABASE_URL base provided`);
        skipped++;
        continue;
      }
      process.stdout.write(`  ➤ ${t.slug} ... `);
      try {
        await execAsync(`npx prisma migrate deploy --schema="${tenantSchemaPath}"`, {
          env: { ...process.env, DATABASE_URL: tenantDbUrl },
          cwd: projectRoot,
          timeout: 180_000,
        });
        console.log("done");
        success++;
      } catch (e: any) {
        console.log("failed");
        console.error(`     ❌ ${t.slug}: ${e?.stderr || e?.message || e}`);
      }
    }

    console.log(`✅ Completed. Success: ${success}, Skipped: ${skipped}, Total: ${tenants.length}`);
  } finally {
    await control.$disconnect();
  }
}

function deriveDbUrl(base: string, dbName: string): string | null {
  if (!base) return null;
  try {
    // Replace trailing path (db segment) with desired db name
    return base.replace(/\/[^/]+$/, `/${dbName}`);
  } catch {
    return null;
  }
}

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
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    // Best-effort; continue if parsing fails
  }
}

main().catch((e) => {
  console.error("❌ Deploy failed:", e);
  process.exit(1);
});
