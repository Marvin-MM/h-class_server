import Redis from 'ioredis';
import type { AppConfig } from '../config/index.js';
import { logger } from '../shared/utils/logger.js';

/**
 * Creates and configures a Redis client instance.
 * Used for session management, caching, rate limiting, and BullMQ backing store.
 */
export function createRedisClient(config: AppConfig): Redis {
  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    retryStrategy(times: number): number | null {
      if (times > 10) {
        logger.error('Redis: maximum retry attempts exceeded');
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (err: Error) => {
    logger.error('Redis client error', { error: err.message });
  });

  return client;
}
