import { Queue } from "bullmq";
import type { Redis } from "ioredis";

// ─── Queue Name Constants ────────────────────────────────────────────────────

/** Queue for sending transactional emails. */
export const EMAIL_QUEUE = "email" as const;

/** Queue for dispatching FCM push notifications. */
export const PUSH_NOTIFICATION_QUEUE = "push-notification" as const;

/** Queue for provisioning subdomains via Cloudflare. */
export const DOMAIN_PROVISIONING_QUEUE = "domain-provisioning" as const;

/** Queue for compiling certificate data payloads. */
export const CERTIFICATE_COMPILATION_QUEUE = "certificate-compilation" as const;

/** Queue for archiving audit log records to S3. */
export const AUDIT_ARCHIVE_QUEUE = "audit-archive" as const;

/** Queue for sending session reminder notifications. */
export const SESSION_REMINDER_QUEUE = "session-reminder" as const;

/** Queue for cleaning up stale FCM push tokens. */
export const PUSH_TOKEN_CLEANUP_QUEUE = "push-token-cleanup" as const;

// ─── Queue Creation ──────────────────────────────────────────────────────────

/** Options shared by all queues. */
interface QueueFactoryOptions {
  readonly connection: Redis;
}

/**
 * Creates all BullMQ queue instances.
 * Queues share a single Redis connection.
 */
export function createQueues(options: QueueFactoryOptions) {
  // Cast to resolve ioredis version mismatch between project ioredis and bullmq's internal ioredis
  const connection =
    options.connection as unknown as import("bullmq").QueueOptions["connection"];

  const emailQueue = new Queue(EMAIL_QUEUE, { connection });
  const pushNotificationQueue = new Queue(PUSH_NOTIFICATION_QUEUE, {
    connection,
  });
  const domainProvisioningQueue = new Queue(DOMAIN_PROVISIONING_QUEUE, {
    connection,
  });
  const certificateCompilationQueue = new Queue(CERTIFICATE_COMPILATION_QUEUE, {
    connection,
  });
  const auditArchiveQueue = new Queue(AUDIT_ARCHIVE_QUEUE, { connection });
  const sessionReminderQueue = new Queue(SESSION_REMINDER_QUEUE, {
    connection,
  });
  const pushTokenCleanupQueue = new Queue(PUSH_TOKEN_CLEANUP_QUEUE, {
    connection,
  });

  return {
    emailQueue,
    pushNotificationQueue,
    domainProvisioningQueue,
    certificateCompilationQueue,
    auditArchiveQueue,
    sessionReminderQueue,
    pushTokenCleanupQueue,
  } as const;
}

/** Type of the queues object returned by createQueues. */
export type AppQueues = ReturnType<typeof createQueues>;
