// apps/control-api/src/provisioning/provisioning.processor.ts
import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common'; // 🔧 AJOUT: Injectable
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { MigratorService } from '../utils/migrator.service';
import { PostgresFactory } from '../utils/postgres.factory';

// 🔧 AJOUT: Interfaces pour le typage
interface DatabaseCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

@Processor('provisioning')
@Injectable() // 🔧 AJOUT: Décorateur Injectable manquant
export class ProvisioningProcessor {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(
    private readonly prisma: ControlPrismaClient,
    private readonly config: ConfigService,
    private readonly postgresFactory: PostgresFactory,
    private readonly migrator: MigratorService,
  ) {}

  @Process('provision-tenant')
  async handleProvisionTenant(
    job: Job<{ tenantId: string; slug: string; name: string }>,
  ): Promise<void> {
    // 🔧 AJOUT: Type de retour explicite
    const { tenantId, slug, name } = job.data;

    this.logger.log(`Starting provisioning for tenant: ${slug} (${tenantId})`);

    try {
      // 1. Récupération du tenant
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, slug: true, name: true, status: true },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      // 2. Création de la base selon l'environnement
      let dbUrl: string | null = null; // 🔧 CORRECTION: Type explicite
      let secretRef: string | null = null; // 🔧 CORRECTION: Type explicite

      if (this.isProduction()) {
        // Production: créer secret + base
        const dbCredentials = await this.createProductionDatabase(slug);
        secretRef = await this.storeInSecretManager(slug, dbCredentials);
        this.logger.log(`Secret stored for tenant: ${slug}`);
      } else {
        // Développement: créer base directement
        dbUrl = await this.createDevelopmentDatabase(slug);
        this.logger.log(`Development DB created: ${slug}_db`);
      }

      // 3. Exécution des migrations
      const connectionUrl =
        dbUrl || (await this.getConnectionFromSecret(secretRef!));

      await this.migrator.runMigrations(connectionUrl);

      // 4. Seeding optionnel
      await this.migrator.seedDatabase(connectionUrl, { name });

      // 5. Test de connexion
      const isConnected =
        await this.migrator.checkDatabaseConnection(connectionUrl);
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }

      // 6. Mise à jour du tenant avec les infos de connexion
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          dbUrl: this.isProduction() ? null : dbUrl,
          secretRef: this.isProduction() ? secretRef : null,
          status: 'ACTIVE',
        },
      });

      this.logger.log(`Provisioning completed for tenant: ${slug}`);
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error); // 🔧 REFACTORING
      this.logger.error(`Provisioning failed for tenant: ${slug}`, {
        error: errorMessage,
      });

      // Marquer le tenant comme failed
      try {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'SUSPENDED' },
        });
      } catch (updateError: unknown) {
        const updateErrorMessage = this.getErrorMessage(updateError); // 🔧 REFACTORING
        this.logger.error('Failed to update tenant status to SUSPENDED', {
          error: updateErrorMessage,
        });
      }

      throw new Error(`Provisioning failed: ${errorMessage}`);
    }
  }

  // 🔧 AJOUT: Méthode utilitaire pour extraire les messages d'erreur
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return JSON.stringify(error);
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production'; // 🔧 AJOUT: Type générique
  }

  private async createDevelopmentDatabase(slug: string): Promise<string> {
    try {
      const dbName = `${slug}_db`;

      // Vérification que la base n'existe pas déjà
      const exists = await this.postgresFactory.databaseExists(dbName);
      if (!exists) {
        await this.postgresFactory.createDatabase(dbName);
      }

      const baseUrl = this.config.get<string>('DATABASE_URL'); // 🔧 AJOUT: Type générique
      if (!baseUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      return baseUrl.replace('/postgres', `/${dbName}`);
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error); // 🔧 UTILISATION: Méthode utilitaire
      this.logger.error(
        `Failed to create development database for ${slug}`,
        { error: errorMessage }, // 🔧 CORRECTION: Format d'objet
      );
      throw new Error(`Development database creation failed: ${errorMessage}`);
    }
  }

  // 🔧 CORRECTION: Type de retour explicite
  private createProductionDatabase(slug: string): Promise<DatabaseCredentials> {
    console.log(slug);

    // TODO: Implémenter selon votre provider cloud
    // AWS RDS, Azure Database, Google Cloud SQL, etc.
    this.logger.warn('Production database creation not implemented yet');
    return Promise.reject(
      new Error('Production database creation not implemented'),
    );
  }

  // 🔧 CORRECTION: Types explicites
  private storeInSecretManager(
    slug: string,
    credentials: DatabaseCredentials,
  ): Promise<string> {
    console.log(slug, credentials);
    // TODO: Implémenter selon votre secret manager
    // AWS Secrets Manager, Azure Key Vault, etc.
    this.logger.warn('Secret manager integration not implemented yet');
    throw new Error('Secret manager integration not implemented');
  }

  private getConnectionFromSecret(secretRef: string): Promise<string> {
    console.log(secretRef);

    // TODO: Récupérer depuis le secret manager
    this.logger.warn('Secret retrieval not implemented yet');
    return Promise.reject(new Error('Secret retrieval not implemented'));
  }
}
