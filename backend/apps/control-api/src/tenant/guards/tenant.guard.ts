import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ControlPrismaService } from '../../prisma/control-prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly prisma: ControlPrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const user = request.user;
    if (!user || !user.sub) {
      throw new ForbiddenException('Authentication required');
    }

    // Resolve tenant from header or try infer from memberships
    const headerSlug =
      request.headers['x-tenant-slug'] ||
      request.headers['x-tenant'] ||
      request.headers['tenant'];

    let tenant = null as
      | { id: string; slug: string; name: string | null; status: string }
      | null;

    if (headerSlug && typeof headerSlug === 'string') {
      tenant = await this.prisma.tenant.findUnique({
        where: { slug: headerSlug.toLowerCase() },
        select: { id: true, slug: true, name: true, status: true },
      });
      if (!tenant) throw new ForbiddenException('Tenant not found');

      // verify user has active membership
      const membership = await this.prisma.membership.findFirst({
        where: { userId: user.sub, tenantId: tenant.id, isActive: true },
        select: { id: true },
      });
      if (!membership)
        throw new ForbiddenException('No active membership for tenant');
    } else {
      // fallback: first active membership
      const m = await this.prisma.membership.findFirst({
        where: { userId: user.sub, isActive: true, tenant: { status: 'ACTIVE' } },
        select: { tenant: { select: { id: true, slug: true, name: true, status: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (!m) throw new ForbiddenException('No active tenant membership');
      tenant = m.tenant as any;
    }

    if (!tenant || tenant.status !== 'ACTIVE') {
      const status = tenant?.status ? tenant.status.toLowerCase() : 'unknown';
      throw new ForbiddenException(`Tenant is ${status}`);
    }

    // Attach to request for @CurrentTenant decorator
    request.tenant = { id: tenant.id, slug: tenant.slug, name: tenant.name } as any;
    return true;
  }
}
