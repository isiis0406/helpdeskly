import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Counter, register } from 'prom-client';
import { RedisRateLimitService } from '../services/redis-rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(
    private reflector: Reflector,
    private readonly redisLimiter: RedisRateLimitService,
  ) {}

  private rejectionCounter: Counter<string> =
    (register.getSingleMetric('http_rate_limit_rejections_total') as any) ||
    new Counter({
      name: 'http_rate_limit_rejections_total',
      help: 'Number of HTTP requests rejected by rate limiter',
      labelNames: ['route', 'source'],
    });

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const ipHeader =
      (request.headers['x-real-ip'] as string) ||
      (request.headers['x-forwarded-for'] as string)?.split(',')[0];
    const ip = ipHeader || request.ip || request.connection?.remoteAddress || 'unknown';

    // Build a key combining IP + route path to scope limits
    const key = `${ip}:${request.method}:${request.path}`;

    const now = Date.now();
    const userAttempts = this.attempts.get(key) || {
      count: 0,
      resetTime: now + rateLimitConfig.windowMs,
    };

    // Reset si la fenêtre est expirée
    if (now > userAttempts.resetTime) {
      userAttempts.count = 0;
      userAttempts.resetTime = now + rateLimitConfig.windowMs;
    }

    // Vérifier la limite distribuée (si Redis OK)
    const redisKey = `${key}`;
    const max = rateLimitConfig.maxAttempts;
    const windowSec = Math.round(rateLimitConfig.windowMs / 1000);
    const rl = await this.redisLimiter.consume(redisKey, 1, max, windowSec);

    // Fallback in-memory + check
    if (userAttempts.count >= rateLimitConfig.maxAttempts || !rl.allowed) {
      try {
        const route = `${request.method} ${request.path}`;
        const source = rl.allowed ? 'memory' : 'redis';
        this.rejectionCounter.labels(route, source).inc(1);
      } catch {}
      throw new HttpException(
        {
          statusCode: 429,
          message: `Too many requests. Please try again in ${Math.ceil((userAttempts.resetTime - now) / 60000)} minutes.`,
          error: 'Too Many Requests',
          retryAfter: Math.ceil(((userAttempts.resetTime - now) || rl.msBeforeNext) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Incrémenter le compteur
    userAttempts.count++;
    this.attempts.set(key, userAttempts);

    return true;
  }
}
