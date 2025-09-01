/*
  Prisma Seed Orchestrator (Tenant DB)
  - Exécute les seeds modulaires pour une base tenant pointée par DATABASE_URL
  - Commande: pnpm db:seed:tenant
*/

import { PrismaClient as TenantPrismaClient } from '.prisma/tenant'
import { seedTicketsAndComments } from './seeds/seedTickets'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execAsync = promisify(exec)

const prisma = new TenantPrismaClient()

async function main() {
  console.log('🌱 Début du seeding Tenant DB...')
  await prisma.$connect()

  // Assure le schéma/migrations avant de semer des données
  const tenantSchemaPath = path.resolve(__dirname, '../schema.prisma')
  const projectRoot = path.resolve(__dirname, '../..')
  try {
    // Appliquer les migrations si présentes
    await execAsync(`npx prisma migrate deploy --schema="${tenantSchemaPath}"`, {
      env: { ...process.env },
      cwd: projectRoot,
      timeout: 120000,
    })
  } catch {}
  try {
    // Fallback dev: pousser le schéma si nécessaire
    await execAsync(`npx prisma db push --schema="${tenantSchemaPath}" --skip-generate`, {
      env: { ...process.env },
      cwd: projectRoot,
      timeout: 120000,
    })
  } catch {}

  // Étape 1: Tickets + Comments + UsageEvents
  await seedTicketsAndComments(prisma)

  console.log('🎉 Seeding Tenant DB terminé.')
}

main()
  .catch((e) => {
    console.error('❌ Erreur pendant le seeding Tenant DB:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
