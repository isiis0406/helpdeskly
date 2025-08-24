// apps/control-api/src/utils/migrator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class MigratorService {
  private readonly logger = new Logger(MigratorService.name);

  constructor(private readonly config: ConfigService) {}

  async runMigrations(databaseUrl: string): Promise<void> {
    this.logger.log('Running tenant database migrations...');

    try {
      // 🔧 CORRECTION : Chemin absolu correct
      // Depuis apps/control-api/src/utils, remonter à la racine du projet
      const schemaPath = path.resolve(
        __dirname, // Répertoire actuel du fichier migrator.service.js
        '../../../../../prisma/tenant/schema.prisma',
      );

      this.logger.debug(`Schema path resolved: ${schemaPath}`);

      // 🔧 VÉRIFICATION : Le fichier existe-t-il ?
      const fs = require('fs');
      if (!fs.existsSync(schemaPath)) {
        this.logger.error(`Schema file not found at: ${schemaPath}`);
        throw new Error(`Schema file not found: ${schemaPath}`);
      }

      const command = `npx prisma migrate deploy --schema="${schemaPath}"`;
      this.logger.debug(`Executing: ${command}`);

      // 🔧 CORRECTION : Working directory à la racine du projet
      const projectRoot = path.resolve(__dirname, '../../../../../');
      this.logger.debug(`Project root: ${projectRoot}`);

      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
        timeout: 60000,
        cwd: projectRoot, // 🔧 IMPORTANT : Exécuter depuis la racine
      });

      if (stdout) {
        this.logger.log(`Migration output: ${stdout}`);
      }

      if (
        stderr &&
        !stderr.includes('warning') &&
        !stderr.includes('migration(s) have been applied')
      ) {
        this.logger.warn(`Migration warnings: ${stderr}`);
      }

      this.logger.log('Migrations completed successfully');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Migration failed', error);
      throw new Error(`Database migration failed: ${errorMessage}`);
    }
  }

  async seedDatabase(
    databaseUrl: string,
    tenantData: { name?: string; slug?: string }, // 🔧 AJOUT : slug manquant
  ): Promise<void> {
    this.logger.log('Seeding tenant database...');

    try {
      // 🔧 CORRECTION : Gestion d'erreur pour l'import
      let TenantPrismaClient;
      try {
        const prismaModule = await import('.prisma/tenant');
        TenantPrismaClient = prismaModule.PrismaClient;
      } catch (importError) {
        this.logger.error('Failed to import tenant Prisma client', importError);
        throw new Error(
          'Tenant Prisma client not available. Run: pnpm exec prisma generate --schema=prisma/tenant/schema.prisma',
        );
      }

      const prisma = new TenantPrismaClient({
        datasources: { db: { url: databaseUrl } },
      });

      // 🔧 CORRECTION : Await manquant
      await this.createDefaultData(prisma, tenantData);

      await prisma.$disconnect();
      this.logger.log('Database seeding completed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Database seeding failed', error);
      throw new Error(`Database seeding failed: ${errorMessage}`);
    }
  }

  // 🔧 CORRECTION : Méthode async
  private async createDefaultData(
    prisma: any,
    tenantData: { name?: string; slug?: string },
  ): Promise<void> {
    this.logger.log(
      `Creating default data for tenant: ${tenantData?.name || 'Unknown'} (${tenantData?.slug || 'no-slug'})`,
    );

    try {
      // 🔧 OPTION : Créer un ticket de bienvenue
      const welcomeTicket = await prisma.ticket.create({
        data: {
          title: 'Welcome to your helpdesk!',
          description: `This is a sample ticket for ${tenantData?.name || 'your organization'}. You can delete this ticket and start creating your own.`,
          status: 'OPEN',
          priority: 'LOW',
          authorId: 'system',
        },
      });

      this.logger.log(`Created welcome ticket: ${welcomeTicket.id}`);
      this.logger.log('Default data creation completed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        'Failed to create default data (non-critical)',
        errorMessage,
      );
      // Ne pas faire échouer le provisioning pour les données par défaut
    }
  }

  async checkDatabaseConnection(databaseUrl: string): Promise<boolean> {
    this.logger.log('Testing database connection...');

    try {
      const { PrismaClient: TenantPrismaClient } = await import(
        '.prisma/tenant'
      );
      const prisma = new TenantPrismaClient({
        datasources: { db: { url: databaseUrl } },
      });

      // 🔧 TEST : Requête simple + vérification des tables
      await prisma.$queryRaw`SELECT 1 as test`;

      // Vérifier que les tables sont créées
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;

      this.logger.debug(
        `Found tables in tenant database: ${JSON.stringify(tables)}`,
      );

      await prisma.$disconnect();

      this.logger.log('Database connection test passed');
      return true;
    } catch (error: unknown) {
      this.logger.error('Database connection check failed', error);
      return false;
    }
  }
}
