import { Injectable, Logger } from '@nestjs/common';
import { RateLimiterRedis, IRateLimiterStoreOptions } from 'rate-limiter-flexible';
import Redis from 'ioredis';

@Injectable()
export class RedisRateLimitService {
  private readonly logger = new Logger(RedisRateLimitService.name);
  private limiter?: RateLimiterRedis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      const client = new Redis(redisUrl, { lazyConnect: true });
      // Do not block boot if Redis not reachable
      client.connect().catch((e) =>
        this.logger.warn(`Rate limiter Redis connect failed: ${e}`),
      );

      const opts: IRateLimiterStoreOptions = {
        storeClient: client as any,
        keyPrefix: 'rlf',
        points: 100, // default
        duration: 60, // per minute
        blockDuration: 0,
      };

      this.limiter = new RateLimiterRedis(opts);
    } catch (e) {
      this.logger.warn('Redis rate limiter disabled');
    }
  }

  async consume(key: string, points = 1, max = 100, duration = 60) {
    if (!this.limiter) return { allowed: true, msBeforeNext: 0 };

    try {
      // runtime tune
      (this.limiter as any).points = max;
      (this.limiter as any).duration = duration;
      const res = await this.limiter.consume(key, points);
      return { allowed: true, msBeforeNext: res.msBeforeNext };
    } catch (rejRes: any) {
      return { allowed: false, msBeforeNext: rejRes.msBeforeNext || 0 };
    }
  }
}

