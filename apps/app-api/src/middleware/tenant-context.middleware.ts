import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantResolutionService } from '../services/tenant-resolution.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(private readonly tenantResolution: TenantResolutionService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    try {
      // Résolution complète du tenant avec CLS
      const tenantContext =
        await this.tenantResolution.resolveTenantFromRequest(req);

      const resolveTime = Date.now() - startTime;
      this.logger.debug(
        `Tenant resolved: ${tenantContext.slug} (${resolveTime}ms)`,
      );

      next();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Tenant resolution failed: ${errorMessage}`);
      next(error);
    }
  }
}
