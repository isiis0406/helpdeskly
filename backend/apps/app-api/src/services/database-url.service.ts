import { Injectable, Logger } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  poolSize?: number;
  connectionTimeout?: number;
}

@Injectable()
export class DatabaseUrlService {
  private readonly logger = new Logger(DatabaseUrlService.name);
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
  }

  async resolveDatabaseUrl(tenant: {
    id: string;
    slug: string;
    dbUrl?: string;
    secretRef?: string;
  }): Promise<DatabaseConfig> {
    try {
      if (this.isProduction) {
        return await this.resolveFromSecretManager(tenant);
      } else {
        return this.resolveFromDirectUrl(tenant);
      }
    } catch (error) {
      this.logger.error(
        `Failed to resolve DB URL for tenant ${tenant.slug}`,
        error,
      );
      throw new Error(`Database configuration error for tenant ${tenant.slug}`);
    }
  }

  private resolveFromDirectUrl(tenant: {
    dbUrl?: string;
    slug: string;
  }): DatabaseConfig {
    if (!tenant.dbUrl) {
      throw new Error(`Missing dbUrl for tenant ${tenant.slug} in development`);
    }

    return {
      url: tenant.dbUrl,
      poolSize: 5, // Développement
      connectionTimeout: 5000,
    };
  }

  private async resolveFromSecretManager(tenant: {
    secretRef?: string;
    slug: string;
  }): Promise<DatabaseConfig> {
    if (!tenant.secretRef) {
      throw new Error(
        `Missing secretRef for tenant ${tenant.slug} in production`,
      );
    }

    const secretValue = await this.getSecretValue(tenant.secretRef);

    return {
      url: secretValue.connectionString,
      poolSize: secretValue.poolSize || 10, // Production
      connectionTimeout: secretValue.connectionTimeout || 30000,
    };
  }

  private async getSecretValue(secretRef: string): Promise<any> {
    const region = process.env.AWS_REGION || 'eu-west-1';
    const client = new SecretsManagerClient({ region });
    const res = await client.send(
      new GetSecretValueCommand({ SecretId: secretRef }),
    );
    if (!res.SecretString) throw new Error('Empty secret value');
    const parsed = JSON.parse(res.SecretString);
    if (!parsed.connectionString) {
      throw new Error('Secret missing connectionString');
    }
    return parsed;
  }
}
