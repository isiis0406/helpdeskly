// middleware/tenant-context.middleware.ts
import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantClientFactory } from 'src/prisma/tenant-prisma.factory';
import { ControlPrismaService } from '../prisma/control-prisma.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly control: ControlPrismaService,
    private readonly factory: TenantClientFactory,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const slug =
      (req.headers['x-tenant-slug'] as string) ?? req.hostname.split('.')[0];

    const tenant = await this.control.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant inactive');
    }

    req.tenant = {
      id: tenant.id,
      slug: tenant.slug,
      prisma: this.factory.get(tenant.dbUrl),
    };

    next();
  }
}
