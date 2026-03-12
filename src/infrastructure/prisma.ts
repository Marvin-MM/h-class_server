import { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../config/index.js";

/**
 * Creates and configures a singleton PrismaClient instance.
 * Query logging is enabled in development and disabled in production.
 */
export function createPrismaClient(config: AppConfig): PrismaClient {
  const client = new PrismaClient({
    log:
      config.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });

  return client;
}
