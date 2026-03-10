/**
 * Server Entry Point.
 * Bootstraps the application: validates config, creates container, starts HTTP server.
 * Handles graceful shutdown (SIGTERM, SIGINT).
 */

import { createServer } from 'node:http';
import { loadConfig } from './config/env.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';
import { logger } from './shared/utils/logger.js';

async function main(): Promise<void> {
  // 1. Validate environment
  const config = loadConfig();
  logger.info('Environment validated', { env: config.NODE_ENV });

  // 2. Create DI container
  const container = createContainer(config);
  logger.info('Dependency injection container created');

  // 3. Build Express app
  const app = createApp(container);

  // 4. Create HTTP server
  const server = createServer(app);
  const port = config.PORT;

  server.listen(port, () => {
    logger.info(`🚀 H-Class LMS Server listening on port ${port}`, {
      environment: config.NODE_ENV,
      port,
    });
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Disconnect from databases and services
        await container.basePrisma.$disconnect();
        logger.info('Prisma client disconnected');

        container.redis.disconnect();
        logger.info('Redis client disconnected');

        logger.info('Graceful shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason });
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error('Failed to start server', {
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
  process.exit(1);
});
