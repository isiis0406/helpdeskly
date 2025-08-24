import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { ControlPrismaService } from '../prisma/control-prisma.service';
import { DatabaseUrlService } from './database-url.service';

export interface TenantContext {
  id: string;
  slug: string;
  dbConfig: {
    url: string;
    poolSize: number;
    connectionTimeout: number;
  };
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@Injectable()
export class TenantResolutionService {
  private readonly logger = new Logger(TenantResolutionService.name);

  constructor(
    private readonly control: ControlPrismaService,
    private readonly databaseUrlService: DatabaseUrlService,
    private readonly cls: ClsService,
  ) {}

  async resolveTenantFromRequest(req: Request): Promise<TenantContext> {
    // 1. Extraction et validation du slug
    const slug = this.extractTenantSlug(req);
    const validatedSlug = this.validateTenantSlug(slug);

    // 2. Recherche du tenant en base de contrôle
    const tenant = await this.findActiveTenant(validatedSlug);

    // 3. Résolution de la configuration DB
    const dbConfig = await this.databaseUrlService.resolveDatabaseUrl({
      id: tenant.id,
      slug: tenant.slug,
      dbUrl: tenant.dbUrl ?? undefined,
      secretRef: tenant.secretRef ?? undefined,
    });

    // 4. Création du contexte complet
    const context: TenantContext = {
      id: tenant.id,
      slug: tenant.slug,
      dbConfig: {
        url: dbConfig.url,
        poolSize: dbConfig.poolSize ?? 10,
        connectionTimeout: dbConfig.connectionTimeout ?? 30000,
      },
    };

    // 5. Injection dans le context local storage
    this.cls.set('tenant', context);

    return context;
  }

  private extractTenantSlug(req: Request): string {
    // Priorité : header custom, puis sous-domaine
    const headerSlug = req.headers['x-tenant-slug'] as string;
    if (headerSlug) return headerSlug;

    // Extraction depuis sous-domaine (ex: acme.helpdesk.com → acme)
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    return subdomain;
  }

  private validateTenantSlug(slug: string): string {
    if (!slug || typeof slug !== 'string') {
      throw new ForbiddenException('Tenant identifier is required');
    }

    // Format strict : lettres minuscules, chiffres, tirets uniquement
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 50 || slug.length < 2) {
      throw new ForbiddenException('Invalid tenant identifier format');
    }

    // Blacklist des slugs réservés
    const reservedSlugs = [
      'api',
      'www',
      'admin',
      'app',
      'mail',
      'ftp',
      'dashboard',
      'portal',
      'support',
      'help',
      'docs',
    ];

    if (reservedSlugs.includes(slug.toLowerCase())) {
      throw new ForbiddenException('Reserved tenant identifier');
    }

    return slug.toLowerCase();
  }

  private async findActiveTenant(slug: string) {
    const tenant = await this.control.tenant.findUnique({
      where: { slug },
      include: {
        memberships: {
          where: { isActive: true },
          include: { user: true },
        },
      },
    });

    if (!tenant) {
      this.logger.warn(`Tenant not found: ${slug}`);
      throw new ForbiddenException('Tenant not found');
    }

    if (tenant.status !== 'ACTIVE') {
      this.logger.warn(`Tenant inactive: ${slug} (status: ${tenant.status})`);
      throw new ForbiddenException(`Tenant is ${tenant.status.toLowerCase()}`);
    }

    return tenant;
  }

  // Getter pour récupérer le contexte courant
  getCurrentTenant(): TenantContext {
    const tenant = this.cls.get('tenant');
    if (!tenant) {
      throw new Error('No tenant context available');
    }
    return tenant;
  }
}
