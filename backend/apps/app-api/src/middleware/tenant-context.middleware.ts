import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantClientFactory } from '../prisma/tenant-prisma.factory'; // ✅ AJOUT
import { TenantResolutionService } from '../services/tenant-resolution.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly tenantResolution: TenantResolutionService,
    private readonly tenantClientFactory: TenantClientFactory, // ✅ INJECTION
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip pour les routes publiques
      if (this.isPublicRoute(req.path)) {
        return next();
      }

      const tenantSlug = this.extractTenantSlug(req);
      if (!tenantSlug) {
        this.logger.warn('Missing tenant header', {
          headers: {
            'x-tenant-slug': req.headers['x-tenant-slug'],
            'x-tenant': req.headers['x-tenant'],
            tenant: req.headers['tenant'],
          },
          path: req.path,
        });
        throw new UnauthorizedException('Tenant header required');
      }

      // Résolution complète du tenant avec CLS
      const tenantContext =
        await this.tenantResolution.resolveTenantFromRequest(req);

      // ✅ AJOUT: Pré-créer le client Prisma et le mettre en cache
      await this.tenantClientFactory.getClient(
        tenantContext.id,
        tenantContext.dbConfig,
      );

      // Ajouter au contexte de la requête
      req.tenantContext = {
        ...tenantContext,
        name: tenantContext.name || tenantContext.slug,
      };
      req.tenantSlug = tenantContext.slug;
      req.tenantId = tenantContext.id;

      const resolveTime = Date.now() - startTime;
      this.logger.debug(
        `Tenant resolved and client cached: ${tenantContext.slug} (${resolveTime}ms) for ${req.method} ${req.path}`,
      );

      next();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Tenant resolution failed for ${req.method} ${req.path}: ${errorMessage}`,
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          headers: {
            'x-tenant-slug': req.headers['x-tenant-slug'],
            'x-tenant': req.headers['x-tenant'],
          },
        },
      );
      next(error);
    }
  }

  // ✅ Harmoniser les noms de headers
  private extractTenantSlug(req: Request): string | undefined {
    return (
      (req.headers['x-tenant-slug'] as string) || // ✅ Header principal de Swagger
      (req.headers['x-tenant'] as string) || // ✅ Header alternatif
      (req.headers['tenant'] as string) || // ✅ Header simple
      req.subdomains[0] // ✅ Fallback sous-domaine
    );
  }

  private isPublicRoute(path: string): boolean {
    const publicRoutes = ['/health', '/metrics', '/api', '/favicon.ico'];
    return publicRoutes.some((route) => path.startsWith(route));
  }
}
