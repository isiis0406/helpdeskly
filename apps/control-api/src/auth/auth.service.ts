import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { ControlPrismaService } from '../prisma/control-prisma.service';

interface SecurityContext {
  ip: string;
  userAgent: string;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  currentTenantId?: string;
  currentTenantSlug?: string;
  memberships: Array<{
    tenantId: string;
    tenantSlug: string;
    role: string;
    isActive: boolean;
  }>;
  sessionId: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    currentTenant?: {
      id: string;
      slug: string;
      name: string;
      role: string;
    };
    memberships: Array<{
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      role: string;
      isActive: boolean;
    }>;
  };
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes

  constructor(
    private readonly prisma: ControlPrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string,
    tenantSlug?: string,
    securityContext?: SecurityContext,
  ) {
    // Validation supplémentaire
    if (!email || !password || !name) {
      throw new BadRequestException('Missing required fields');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    let tenant: any = null;
    if (tenantSlug) {
      tenant = await this.prisma.tenant.findUnique({
        where: { slug: tenantSlug, status: 'ACTIVE' },
      });

      if (!tenant) {
        throw new UnauthorizedException('Tenant not found or inactive');
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        isActive: true,
      },
    });

    if (tenant) {
      await this.prisma.membership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: 'OWNER',
          isActive: true,
        },
      });
    }

    this.logger.log(
      `User registered: ${email}${tenant ? ` in tenant ${tenant.slug}` : ''} from ${securityContext?.ip}`,
    );

    return this.generateTokens(user.id, tenant?.id, securityContext);
  }

  async login(
    email: string,
    password: string,
    tenantSlug?: string,
    securityContext?: SecurityContext,
  ): Promise<LoginResult> {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim(), isActive: true },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            tenant: {
              select: { id: true, slug: true, name: true, status: true },
            },
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log tentative de connexion échouée
      this.logger.warn(
        `Failed login attempt for email: ${email} from IP: ${securityContext?.ip}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    let currentTenantId: string | undefined;

    if (tenantSlug) {
      const membership = user.memberships.find(
        (m) => m.tenant.slug === tenantSlug && m.tenant.status === 'ACTIVE',
      );

      if (!membership) {
        throw new ForbiddenException('Access denied to this tenant');
      }

      currentTenantId = membership.tenantId;
    } else if (user.memberships.length === 1) {
      currentTenantId = user.memberships[0].tenantId;
    }

    this.logger.log(
      `User logged in: ${email}${tenantSlug ? ` in tenant ${tenantSlug}` : ''} from ${securityContext?.ip}`,
    );

    return this.generateTokens(user.id, currentTenantId, securityContext);
  }

  async switchTenant(
    userId: string,
    tenantSlug: string,
    securityContext?: SecurityContext,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            tenant: {
              select: { id: true, slug: true, name: true, status: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const membership = user.memberships.find(
      (m) => m.tenant.slug === tenantSlug && m.tenant.status === 'ACTIVE',
    );

    if (!membership) {
      throw new ForbiddenException('Access denied to this tenant');
    }

    this.logger.log(
      `User ${user.email} switched to tenant ${tenantSlug} from ${securityContext?.ip}`,
    );

    return this.generateTokens(user.id, membership.tenantId, securityContext);
  }

  async refreshTokens(
    refreshToken: string,
    securityContext?: SecurityContext,
  ): Promise<Omit<LoginResult, 'user'>> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const session = await this.prisma.session.findUnique({
      where: {
        refreshToken,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            memberships: {
              where: { isActive: true },
              include: {
                tenant: {
                  select: { id: true, slug: true, name: true, status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session || !session.user.isActive) {
      this.logger.warn(
        `Invalid refresh token attempt from IP: ${securityContext?.ip}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Vérification de sécurité: même user agent
    if (
      securityContext?.userAgent &&
      session.userAgent !== securityContext.userAgent
    ) {
      this.logger.warn(
        `User agent mismatch for session ${session.id} from IP: ${securityContext?.ip}`,
      );
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Security violation detected');
    }

    await this.revokeSession(session.id);

    const tokens = await this.generateTokens(
      session.userId,
      session.tenantId ?? undefined,
      securityContext,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const result = await this.prisma.session.deleteMany({
      where: { refreshToken },
    });

    if (result.count === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    this.logger.log(`All sessions revoked for user: ${userId}`);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
  }

  private async generateTokens(
    userId: string,
    currentTenantId?: string,
    securityContext?: SecurityContext,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            tenant: {
              select: { id: true, slug: true, name: true, status: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentTenant = currentTenantId
      ? user.memberships.find((m) => m.tenantId === currentTenantId)
      : null;

    const jti = randomBytes(16).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + this.config.get<number>('REFRESH_TOKEN_DAYS', 7),
    );

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tenantId: currentTenantId,
        accessToken: jti,
        refreshToken,
        expiresAt,
        userAgent: securityContext?.userAgent || 'unknown',
        ipAddress: securityContext?.ip || 'unknown',
      },
    });

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = this.config.get<number>('JWT_EXPIRES_IN_SECONDS', 900);

    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      currentTenantId: currentTenant?.tenantId,
      currentTenantSlug: currentTenant?.tenant.slug,
      memberships: user.memberships
        .filter((m) => m.tenant.status === 'ACTIVE')
        .map((m) => ({
          tenantId: m.tenantId,
          tenantSlug: m.tenant.slug,
          role: m.role,
          isActive: m.isActive,
        })),
      sessionId: session.id,
      jti,
      iat: now,
      exp: now + expiresIn,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar ?? undefined,
        currentTenant: currentTenant
          ? {
              id: currentTenant.tenantId,
              slug: currentTenant.tenant.slug,
              name: currentTenant.tenant.name ?? '',
              role: String(currentTenant.role),
            }
          : undefined,
        memberships: user.memberships
          .filter((m) => m.tenant.status === 'ACTIVE')
          .map((m) => ({
            tenantId: m.tenantId,
            tenantSlug: m.tenant.slug,
            tenantName: m.tenant.name ?? '',
            role: String(m.role),
            isActive: m.isActive,
          })),
      },
      expiresIn,
    };
  }
}
