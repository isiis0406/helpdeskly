/*
  Prisma Seed Orchestrator (Control DB)
  - Exécute les seeds modulaires (ex: plans)
  - Commande: pnpm db:seed:control (ou prisma db seed --schema prisma/control/schema.prisma)
*/

import { PrismaClient as ControlPrismaClient } from ".prisma/control";
import {
  PrismaClient as TenantPrismaClient,
  TicketPriority,
  TicketStatus,
} from ".prisma/tenant";
import * as bcrypt from "bcrypt";
import { exec } from "child_process";
import { Client as PgClient } from "pg";
import * as path from "path";
import { promisify } from "util";
import { seedTicketsAndComments } from "../tenant/seeds/seedTickets";
import { seedPlans } from "./seeds/seedPlans";

const execAsync = promisify(exec);

const prisma = new ControlPrismaClient();

async function main() {
  console.log("🌱 Début du seeding Control DB...");
  await prisma.$connect();

  // Étape 1: Plans (depuis PLANS_CONFIG)
  await seedPlans(prisma);

  // Optionnel: Pruner les plans absents de la config
  await maybePrunePlans(prisma);

  // Étape 2: Créer/provisionner un tenant de test avec données de démo
  const testTenant = await ensureAndProvisionTestTenant(prisma, {
    slug: process.env.SEED_TEST_TENANT_SLUG || "test",
    name: process.env.SEED_TEST_TENANT_NAME || "Test Workspace",
    includeDemoData: true,
  });

  // Créer des utilisateurs de démo côté Control et memberships dans le tenant test
  await ensureDemoUsers(prisma, testTenant.id);

  console.log("🎉 Seeding Control DB terminé.");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant le seeding Control DB:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function ensureAndProvisionTestTenant(
  control: ControlPrismaClient,
  opts: { slug: string; name: string; includeDemoData?: boolean }
): Promise<{ id: string; slug: string; name: string }> {
  const { slug, name, includeDemoData } = opts;
  console.log(`➡️  Ensure tenant '${slug}' exists and is provisioned`);

  const existing = await control.tenant.findUnique({ where: { slug } });
  let tenant = existing;
  if (!tenant) {
    tenant = await control.tenant.create({
      data: {
        slug,
        name,
        status: "PROVISIONING",
      },
    });
    console.log(`  ➕ Created tenant '${slug}' (${tenant.id})`);
  } else {
    console.log(`  ℹ️  Tenant '${slug}' already exists (${tenant.id})`);
  }

  // Construire l'URL de base pour les DB tenants
  const baseUrl =
    process.env.DATABASE_URL ||
    "postgresql://root:root@localhost:5436/postgres";
  if (!baseUrl.includes("/")) {
    throw new Error("Invalid DATABASE_URL for tenant base");
  }
  const dbName = `${slug}_db`;
  const tenantDbUrl = baseUrl.replace(/\/[^/]+$/, `/${dbName}`);

  // Appliquer le schema tenant et créer la DB si nécessaire
  const tenantSchemaPath = path.resolve(__dirname, "../tenant/schema.prisma");
  const projectRoot = path.resolve(__dirname, "../..");

  console.log("  🗄️  Ensuring tenant database exists");
  await ensureDatabaseExists(baseUrl, dbName);

  console.log("  🛠  Applying tenant migrations (migrate deploy)");
  const cmd = `npx prisma migrate deploy --schema="${tenantSchemaPath}"`;
  await execAsync(cmd, {
    env: { ...process.env, DATABASE_URL: tenantDbUrl },
    cwd: projectRoot,
    timeout: 120000,
  });

  // Fallback dev: ensure schema is fully in place even if no migrations exist
  console.log("  🔁 Ensuring schema via db push (dev fallback)");
  const pushCmd = `npx prisma db push --schema="${tenantSchemaPath}" --skip-generate`;
  await execAsync(pushCmd, {
    env: { ...process.env, DATABASE_URL: tenantDbUrl },
    cwd: projectRoot,
    timeout: 120000,
  });

  // Seed de démo (tickets, comments) via Prisma client tenant
  const tenantPrisma = new TenantPrismaClient({
    datasources: { db: { url: tenantDbUrl } },
  });
  await tenantPrisma.$connect();
  try {
    // Ticket de bienvenue minimal
    await tenantPrisma.ticket.upsert({
      where: { id: "welcome-ticket" },
      create: {
        id: "welcome-ticket",
        title: "Welcome to your helpdesk!",
        description: `This is a sample ticket for ${name}.`,
        status: TicketStatus.OPEN,
        priority: TicketPriority.LOW,
        authorId: "system",
      },
      update: {},
    });

    if (includeDemoData) {
      // Utilise notre seed modulaires pour enrichir
      await seedTicketsAndComments(tenantPrisma as any);
    }
  } finally {
    await tenantPrisma.$disconnect();
  }

  // Mettre à jour le tenant avec la connexion et le statut ACTIVE (dev)
  const updated = await control.tenant.update({
    where: { id: tenant.id },
    data: {
      dbUrl: tenantDbUrl,
      status: "ACTIVE",
    },
  });

  console.log(`  ✅ Tenant '${slug}' provisioned at ${dbName}`);
  return { id: updated.id, slug: updated.slug, name: updated.name || name };
}

async function ensureDatabaseExists(adminUrl: string, dbName: string) {
  const client = new PgClient({ connectionString: adminUrl });
  await client.connect();
  try {
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (res.rowCount && res.rowCount > 0) {
      return;
    }
    await client.query(`CREATE DATABASE "${dbName}" TEMPLATE template0;`);
  } finally {
    await client.end();
  }
}

async function maybePrunePlans(prisma: ControlPrismaClient) {
  const mode = (process.env.SEED_PRUNE_PLANS || "").toLowerCase();
  if (!mode) return;

  console.log(`🧹 Pruning plans (mode=${mode})`);
  const { PLANS_CONFIG } = await import(
    "../../apps/control-api/src/billing/config/plans.config"
  );
  const keepIds = new Set(PLANS_CONFIG.map((p: any) => p.id));

  const existing = await prisma.plan.findMany({ select: { id: true } });
  const toPrune = existing.filter((p) => !keepIds.has(p.id));
  if (toPrune.length === 0) {
    console.log("  ℹ️  No plans to prune");
    return;
  }

  if (mode === "delete") {
    for (const p of toPrune) {
      await prisma.plan.delete({ where: { id: p.id } });
      console.log(`  🗑  Deleted plan: ${p.id}`);
    }
  } else {
    for (const p of toPrune) {
      await prisma.plan.update({
        where: { id: p.id },
        data: { isActive: false },
      });
      console.log(`  🚫 Disabled plan: ${p.id}`);
    }
  }
}

async function ensureDemoUsers(prisma: ControlPrismaClient, tenantId: string) {
  console.log("👥 Ensure demo users and memberships in Control DB");

  const users = [
    {
      id: "user_demo_author",
      email: "author.demo@helpdeskly.local",
      name: "Demo Author",
      role: "OWNER" as const,
      password: "demo1234",
    },
    {
      id: "user_demo_agent",
      email: "agent.demo@helpdeskly.local",
      name: "Demo Agent",
      role: "ADMIN" as const,
      password: "demo1234",
    },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    // Upsert user by id (deterministic for tenant seeds)
    const user = await prisma.user.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        name: u.name,
        isActive: true,
        password: hashed,
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        isActive: true,
        password: hashed,
      },
    });

    // Upsert membership
    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId } },
      update: { role: u.role, isActive: true },
      create: { userId: user.id, tenantId, role: u.role, isActive: true },
    });

    console.log(`  ✅ Demo user ensured: ${u.email} (${u.role})`);
  }
}
