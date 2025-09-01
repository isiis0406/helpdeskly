import { PrismaClient as ControlPrismaClient } from '.prisma/control';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { MigratorService } from '../utils/migrator.service';
import { PostgresFactory } from '../utils/postgres.factory';

interface DatabaseCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

@Processor('provisioning')
@Injectable()
export class ProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(
    private readonly prisma: ControlPrismaClient,
    private readonly config: ConfigService,
    private readonly postgresFactory: PostgresFactory,
    private readonly migrator: MigratorService,
  ) {
    super();
  }

  async process(
    job: Job<{ tenantId: string; slug: string; name: string }>,
  ): Promise<void> {
    if (job.name !== 'provision-tenant') {
      return;
    }

    const { tenantId, slug, name } = job.data;

    this.logger.log(`Starting provisioning for tenant: ${slug} (${tenantId})`);

    try {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'PROVISIONING' },
      });

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, slug: true, name: true, status: true },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      let dbUrl: string | null = null;
      let secretRef: string | null = null;

      if (this.isProduction()) {
        const dbCredentials = await this.createProductionDatabase(slug);
        secretRef = await this.storeInSecretManager(slug, dbCredentials);
        this.logger.log(`Secret stored for tenant: ${slug}`);
      } else {
        dbUrl = await this.createDevelopmentDatabase(slug);
        this.logger.log(`Development DB created: ${slug}_db`);
      }

      const connectionUrl =
        dbUrl || (await this.getConnectionFromSecret(secretRef!));

      await this.migrator.runMigrations(connectionUrl);
      await this.migrator.seedDatabase(connectionUrl, { name });

      const isConnected =
        await this.migrator.checkDatabaseConnection(connectionUrl);
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }

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
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Provisioning failed for tenant: ${slug}`, {
        error: errorMessage,
        tenantId,
        jobId: job.id,
      });

      try {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            status: 'SUSPENDED',
          },
        });
      } catch (updateError: unknown) {
        const updateErrorMessage = this.getErrorMessage(updateError);
        this.logger.error('Failed to update tenant status to SUSPENDED', {
          error: updateErrorMessage,
          tenantId,
        });
      }

      throw new Error(`Provisioning failed: ${errorMessage}`);
    }
  }

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
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private async createDevelopmentDatabase(slug: string): Promise<string> {
    try {
      const dbName = `${slug}_db`;

      const exists = await this.postgresFactory.databaseExists(dbName);
      if (!exists) {
        await this.postgresFactory.createDatabase(dbName);
      }

      const baseUrl = this.config.get<string>('DATABASE_URL');
      if (!baseUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      return baseUrl.replace('/postgres', `/${dbName}`);
    } catch (error: unknown) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Failed to create development database for ${slug}`, {
        error: errorMessage,
      });
      throw new Error(`Development database creation failed: ${errorMessage}`);
    }
  }

  private createProductionDatabase(slug: string): Promise<DatabaseCredentials> {
    console.log(slug);
    this.logger.warn('Production database creation not implemented yet');
    return Promise.reject(
      new Error('Production database creation not implemented'),
    );
  }

  private storeInSecretManager(
    slug: string,
    credentials: DatabaseCredentials,
  ): Promise<string> {
    console.log(slug, credentials);
    this.logger.warn('Secret manager integration not implemented yet');
    throw new Error('Secret manager integration not implemented');
  }

  private getConnectionFromSecret(secretRef: string): Promise<string> {
    console.log(secretRef);
    this.logger.warn('Secret retrieval not implemented yet');
    return Promise.reject(new Error('Secret retrieval not implemented'));
  }
}
