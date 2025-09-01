/*
  Seed des plans dans la base Control (Prisma schema: control)
  - Source: apps/control-api/src/billing/config/plans.config.ts
  - Écrit/Met à jour les enregistrements dans la table `plans`
*/

import { PrismaClient as ControlPrismaClient } from '.prisma/control'
import {
  PLANS_CONFIG,
  type PlanConfig,
} from '../apps/control-api/src/billing/config/plans.config'

async function main() {
  const prisma = new ControlPrismaClient()
  await prisma.$connect()

  console.log('🌱 Seeding plans into Control DB...')

  // Tri par sortOrder pour consistance
  const plans = [...PLANS_CONFIG].sort(
    (a, b) => (a.sortOrder || 999) - (b.sortOrder || 999),
  )

  for (const cfg of plans) {
    await upsertPlan(prisma, cfg)
  }

  const count = await prisma.plan.count()
  console.log(`✅ Plans seeded. Total plans in DB: ${count}`)

  await prisma.$disconnect()
}

async function upsertPlan(prisma: ControlPrismaClient, cfg: PlanConfig) {
  // Note: on upsert par ID pour garantir l'alignement avec getPlanConfig(plan.id)
  // (PlanService lit la config via l'ID; il faut que l'ID DB == cfg.id)
  const data = {
    id: cfg.id,
    name: cfg.name,
    displayName: cfg.displayName,
    description: cfg.description,
    // Decimal: utiliser string pour compatibilité
    priceMonthly: cfg.priceMonthly.toString(),
    priceYearly: cfg.priceYearly?.toString() ?? null,
    currency: cfg.currency,
    // Limites
    maxUsers: cfg.limits.users,
    maxTickets: cfg.limits.tickets,
    maxStorage: cfg.limits.storage,
    maxApiCalls: cfg.limits.apiCalls,
    // Stripe
    stripePriceIdMonthly: cfg.stripe.priceIdMonthly || null,
    stripePriceIdYearly: cfg.stripe.priceIdYearly || null,
    stripeProductId: cfg.stripe.productId || null,
    // Divers
    isActive: cfg.isActive !== false,
    isPopular: !!cfg.isPopular,
    sortOrder: cfg.sortOrder ?? 0,
    // Stocker aussi les features dans la colonne JSON pour visibilité
    features: cfg.features as any,
  }

  try {
    const existing = await prisma.plan.findUnique({ where: { id: cfg.id } })
    if (!existing) {
      await prisma.plan.create({ data })
      console.log(`  ➕ Created plan: ${cfg.id}`)
      return
    }

    await prisma.plan.update({ where: { id: cfg.id }, data })
    console.log(`  ♻️  Updated plan: ${cfg.id}`)
  } catch (err: any) {
    console.error(`  ❌ Failed upserting plan ${cfg.id}:`, err?.message || err)
    throw err
  }
}

main().catch(async (e) => {
  console.error(e)
  process.exitCode = 1
})

