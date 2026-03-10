import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type { Redis } from 'ioredis';

/**
 * Creates rate limiting middleware instances for different endpoint categories.
 * Uses Redis as the backing store for cross-process rate limiting.
 */
export function createRateLimiters(redisClient: Redis) {
  const createStore = (prefix: string) =>
    new RedisStore({
      // @ts-expect-error ioredis call signature compatibility with rate-limit-redis
      sendCommand: (...args: string[]) => redisClient.call(args[0]!, ...args.slice(1)),
      prefix,
    });

  /**
   * Rate limiter for auth endpoints (login, register).
   * 5 requests per minute per IP.
   */
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('rl:auth:'),
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many authentication attempts. Please try again later.' } },
  });

  /**
   * Rate limiter for file upload endpoints.
   * 10 requests per hour per authenticated user.
   */
  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId ?? 'anonymous',
    store: createStore('rl:upload:'),
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many upload requests. Please try again later.' } },
  });

  /**
   * Rate limiter for general API endpoints.
   * 100 requests per minute per authenticated user.
   */
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId ?? 'anonymous',
    store: createStore('rl:api:'),
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' } },
  });

  return { authLimiter, uploadLimiter, apiLimiter };
}
