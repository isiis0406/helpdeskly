import { PrismaClient } from '.prisma/tenant';
import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TenantClientFactory } from '../prisma/tenant-prisma.factory';
import type { TenantContext } from './tenant-resolution.service';

@Injectable()
export class TenantPrismaService {
  private readonly logger = new Logger(TenantPrismaService.name);

  constructor(
    private readonly cls: ClsService,
    private readonly factory: TenantClientFactory,
  ) {}

  // CORRECTION: Getter synchrone pour client
  get client(): PrismaClient {
    const tenant = this.getCurrentTenant();
    // On récupère le client depuis le cache (supposé déjà connecté via middleware)
    return this.factory.getCachedClient(tenant.id);
  }

  // Méthode asynchrone pour récupérer/créer un client
  async getClient(): Promise<PrismaClient> {
    const tenant = this.getCurrentTenant();
    return this.getClientForTenant(tenant);
  }

  // Méthode explicite pour récupérer un client
  async getClientForTenant(tenant: TenantContext): Promise<PrismaClient> {
    return await this.factory.getClient(tenant.id, tenant.dbConfig);
  }

  // Récupération du contexte tenant courant
  private getCurrentTenant(): TenantContext {
    const tenant = this.cls.get('tenant');
    if (!tenant) {
      throw new Error(
        'No tenant context available. Make sure TenantMiddleware is applied.',
      );
    }
    return tenant;
  }

  // Helper methods pour les opérations courantes avec le tenant courant
  async findMany<T>(model: string, args?: any): Promise<T[]> {
    const client = (await this.getClient()) as any;
    return client[model].findMany(args);
  }

  async findUnique<T>(model: string, args: any): Promise<T | null> {
    const client = (await this.getClient()) as any;
    return client[model].findUnique(args);
  }

  async create<T>(model: string, args: any): Promise<T> {
    const client = (await this.getClient()) as any;
    return client[model].create(args);
  }

  async update<T>(model: string, args: any): Promise<T> {
    const client = (await this.getClient()) as any;
    return client[model].update(args);
  }

  async delete<T>(model: string, args: any): Promise<T> {
    const client = (await this.getClient()) as any;
    return client[model].delete(args);
  }

  // Transaction support
  async transaction<T>(
    fn: (
      prisma: Omit<
        PrismaClient,
        | '$connect'
        | '$disconnect'
        | '$on'
        | '$transaction'
        | '$use'
        | '$extends'
      >,
    ) => Promise<T>,
  ): Promise<T> {
    const client = await this.getClient();
    return client.$transaction(fn);
  }

  // Métriques du tenant courant
  getTenantInfo(): TenantContext {
    return this.getCurrentTenant();
  }
}
