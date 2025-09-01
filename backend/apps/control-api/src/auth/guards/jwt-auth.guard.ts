import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ControlPrismaService } from '../../prisma/control-prisma.service';
import { IS_PUBLIC_KEY } from '../decortors/public.decorator';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      sessionId?: string;
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: ControlPrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ✅ PRÉSERVER: Vérifier si la route est publique
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // ✅ Route publique - pas d'auth requise
    }
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      const session = await this.prisma.session.findUnique({
        where: {
          accessToken: payload.jti,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
              isActive: true,
            },
          },
        },
      });

      if (!session || !session.user.isActive) {
        throw new UnauthorizedException('Session not found or user inactive');
      }

      request.user = payload;
      request.sessionId = session.id;

      return true;
    } catch (error) {
      this.logger.error('Token validation failed', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
