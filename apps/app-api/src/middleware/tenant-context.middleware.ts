import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantResolutionService } from '../services/tenant-resolution.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(private readonly tenantResolution: TenantResolutionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip pour les routes publiques
      if (this.isPublicRoute(req.path)) {
        return next();
      }

      // Vérifier la présence du header tenant
      const tenantSlug = this.extractTenantSlug(req);
      if (!tenantSlug) {
        throw new UnauthorizedException('Tenant header required');
      }

      // Résolution complète du tenant avec CLS
      const tenantContext =
        await this.tenantResolution.resolveTenantFromRequest(req);

      // Ajouter au contexte de la requête
      req.tenantContext = {
        ...tenantContext,
        name: tenantContext.name || tenantContext.slug,
      };
      req.tenantSlug = tenantContext.slug;
      req.tenantId = tenantContext.id;

      const resolveTime = Date.now() - startTime;
      this.logger.debug(
        `Tenant resolved: ${tenantContext.slug} (${resolveTime}ms) for ${req.method} ${req.path}`,
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
          tenantSlug: req.headers['x-tenant'],
        },
      );
      next(error);
    }
  }

  private extractTenantSlug(req: Request): string | undefined {
    return (
      (req.headers['x-tenant'] as string) ||
      (req.headers['tenant'] as string) ||
      req.subdomains[0]
    );
  }

  private isPublicRoute(path: string): boolean {
    const publicRoutes = ['/health', '/metrics', '/api-docs', '/favicon.ico'];
    return publicRoutes.some((route) => path.startsWith(route));
  }
}
