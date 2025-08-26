import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les métadonnées de rate limiting
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      'skipRateLimit',
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) {
      return true;
    }

    const rateLimitConfig = this.reflector.getAllAndOverride(
      'rateLimitConfig',
      [context.getHandler(), context.getClass()],
    ) || { maxAttempts: 10, windowMs: 15 * 60 * 1000 }; // Défaut: 10 req/15min

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';

    const now = Date.now();
    const userAttempts = this.attempts.get(ip) || {
      count: 0,
      resetTime: now + rateLimitConfig.windowMs,
    };

    // Reset si la fenêtre est expirée
    if (now > userAttempts.resetTime) {
      userAttempts.count = 0;
      userAttempts.resetTime = now + rateLimitConfig.windowMs;
    }

    // Vérifier la limite
    if (userAttempts.count >= rateLimitConfig.maxAttempts) {
      throw new HttpException(
        {
          statusCode: 429,
          message: `Too many requests. Please try again in ${Math.ceil((userAttempts.resetTime - now) / 60000)} minutes.`,
          error: 'Too Many Requests',
          retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Incrémenter le compteur
    userAttempts.count++;
    this.attempts.set(ip, userAttempts);

    return true;
  }
}
