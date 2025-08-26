import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { UserEnrichmentService } from '../../user-enrichment/user-enrichment.service';

@Injectable()
export class TenantJwtGuard implements CanActivate {
  private readonly logger = new Logger(TenantJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly controlPrisma: ControlPrismaService,
    private readonly userEnrichment: UserEnrichmentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
        issuer: this.config.get<string>('JWT_ISSUER'),
        audience: this.config.get<string>('JWT_AUDIENCE'),
      });

      // ✅ CORRECTION: Harmoniser l'extraction du tenant slug
      const tenantSlug = this.extractTenantSlug(request);

      if (!tenantSlug) {
        this.logger.warn('Missing tenant header in JWT guard', {
          headers: {
            'x-tenant-slug': request.headers['x-tenant-slug'],
            'x-tenant': request.headers['x-tenant'],
            tenant: request.headers['tenant'],
          },
          user: payload.sub,
        });
        throw new UnauthorizedException('Tenant header required');
      }

      // Vérification des permissions tenant
      const hasAccessToTenant = payload.memberships?.some(
        (m: any) => m.tenantSlug === tenantSlug && m.isActive,
      );

      if (!hasAccessToTenant) {
        this.logger.warn(
          `Access denied to tenant ${tenantSlug} for user ${payload.sub}`,
          {
            userMemberships: payload.memberships?.map((m: any) => m.tenantSlug),
            requestedTenant: tenantSlug,
          },
        );
        throw new ForbiddenException('Access denied to this tenant');
      }

      const membership = payload.memberships.find(
        (m: any) => m.tenantSlug === tenantSlug,
      );

      // Vérification session active
      const session = await this.controlPrisma.session.findUnique({
        where: {
          accessToken: payload.jti,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Session expired or invalid');
      }

      // Enrichissement du contexte utilisateur
      const tenant = await this.controlPrisma.tenant.findUnique({
        where: { slug: tenantSlug, status: 'ACTIVE' },
        select: {
          id: true,
          slug: true,
          name: true,
          dbUrl: true,
          secretRef: true,
        },
      });

      if (!tenant) {
        throw new UnauthorizedException('Tenant not found or inactive');
      }

      // Enrichir l'utilisateur avec ses permissions pour ce tenant
      const enrichedUser = await this.userEnrichment.enrichUserForTenant(
        payload.sub,
        tenant.id,
      );

      // Contexte enrichi pour les contrôleurs
      request.user = enrichedUser;
      request.currentTenant = {
        ...tenant,
        name: tenant.name ?? '',
        dbUrl: tenant.dbUrl ?? undefined,
        secretRef: tenant.secretRef ?? undefined,
      };
      request.membership = membership;
      request.tenantId = tenant.id;
      request.tenantSlug = tenant.slug;
      request.userRole = membership.role;
      request.sessionId = session.id;

      this.logger.debug(
        `User ${payload.email} authenticated for tenant ${tenantSlug}`,
      );

      return true;
    } catch (error) {
      this.logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : String(error),
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Invalid token');
    }
  }

  // ✅  Extraction cohérente du tenant slug
  private extractTenantSlug(request: Request): string | undefined {
    return (
      (request.headers['x-tenant-slug'] as string) || // ✅ Header principal
      (request.headers['x-tenant'] as string) || // ✅ Header alternatif
      (request.headers['tenant'] as string) || // ✅ Header simple
      request.tenantSlug // ✅ Depuis middleware
    );
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
