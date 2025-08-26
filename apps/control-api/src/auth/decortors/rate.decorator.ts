import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimitConfig';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Configure le rate limiting pour une route
 */
export const RateLimit = (config: { maxAttempts: number; windowMs: number }) =>
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Skip complètement le rate limiting
 */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

/**
 * Configurations prédéfinies
 */
export const RateLimitStrict = () =>
  RateLimit({ maxAttempts: 3, windowMs: 15 * 60 * 1000 }); // 3/15min
export const RateLimitModerate = () =>
  RateLimit({ maxAttempts: 10, windowMs: 15 * 60 * 1000 }); // 10/15min
export const RateLimitRelaxed = () =>
  RateLimit({ maxAttempts: 100, windowMs: 15 * 60 * 1000 }); // 100/15min
