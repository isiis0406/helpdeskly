import { PrismaClient as ControlPrismaClient } from '.prisma/control'
import { PLANS_CONFIG, type PlanConfig } from '../../../apps/control-api/src/billing/config/plans.config'

export async function seedPlans(prisma: ControlPrismaClient) {
  console.log('➡️  Seeding: plans')

  const plans = [...PLANS_CONFIG].sort(
    (a, b) => (a.sortOrder || 999) - (b.sortOrder || 999),
  )

  for (const cfg of plans) {
    await upsertPlan(prisma, cfg)
  }

  const count = await prisma.plan.count()
  console.log(`✅ Plans seed terminé. Nombre total: ${count}`)
}

async function upsertPlan(prisma: ControlPrismaClient, cfg: PlanConfig) {
  const data = {
    id: cfg.id,
    name: cfg.name,
    displayName: cfg.displayName,
    description: cfg.description,
    priceMonthly: cfg.priceMonthly.toString(),
    priceYearly: cfg.priceYearly?.toString() ?? null,
    currency: cfg.currency,
    maxUsers: cfg.limits.users,
    maxTickets: cfg.limits.tickets,
    maxStorage: cfg.limits.storage,
    maxApiCalls: cfg.limits.apiCalls,
    stripePriceIdMonthly: cfg.stripe.priceIdMonthly || null,
    stripePriceIdYearly: cfg.stripe.priceIdYearly || null,
    stripeProductId: cfg.stripe.productId || null,
    isActive: cfg.isActive !== false,
    isPopular: !!cfg.isPopular,
    sortOrder: cfg.sortOrder ?? 0,
    features: cfg.features as any,
  }

  const exists = await prisma.plan.findUnique({ where: { id: cfg.id } })
  if (!exists) {
    await prisma.plan.create({ data })
    console.log(`  ➕ Created plan: ${cfg.id}`)
    return
  }

  await prisma.plan.update({ where: { id: cfg.id }, data })
  console.log(`  ♻️  Updated plan: ${cfg.id}`)
}

