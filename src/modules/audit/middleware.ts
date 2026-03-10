// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;
import { asyncContext } from '../../shared/utils/async-context.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Prisma middleware for automatic audit logging.
 * Captures create/update/delete operations on watched models
 * and writes immutable AuditLog records tagged with the actor from AsyncLocalStorage.
 */

/** Models to track in the audit log. */
const AUDITED_MODELS = new Set([
  'User', 'Course', 'Enrollment', 'Session', 'Note',
  'Assessment', 'Submission', 'Certificate', 'Transaction',
  'TutorApplication', 'Domain', 'AppConfig',
]);

const ACTION_MAP: Record<string, string> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  upsert: 'UPSERT',
};

/**
 * Registers the audit log middleware on the Prisma client.
 */
export function registerAuditMiddleware(prisma: PrismaClient): void {
  (prisma as unknown as { $use: (middleware: (params: Record<string, unknown>, next: (params: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>) => void }).$use(
    async (params: Record<string, unknown>, next: (params: Record<string, unknown>) => Promise<unknown>) => {
      const result = await next(params);

      const model = params['model'] as string | undefined;
      const action = params['action'] as string | undefined;

      // Only log for audited models and tracked actions
      if (!model || !AUDITED_MODELS.has(model)) return result;
      const mappedAction = action ? ACTION_MAP[action] : undefined;
      if (!mappedAction) return result;

      // Get actor from async context
      const ctx = asyncContext.getStore();
      const actorId = ctx?.actorId ?? undefined;

      try {
        // Extract resource ID
        const resourceId = extractResourceId(result);

        await (prisma as unknown as { auditLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> } }).auditLog.create({
          data: {
            actorId,
            action: mappedAction,
            resourceType: model,
            resourceId,
            before: action === 'update' ? JSON.stringify((params['args'] as Record<string, unknown>)?.['where']) : undefined,
            after: result ? JSON.stringify(sanitizeForAudit(result)) : undefined,
          },
        });
      } catch (error) {
        // Never let audit failures break the main operation
        logger.error('Failed to write audit log', { error, model, action: mappedAction });
      }

      return result;
    },
  );
}

function extractResourceId(result: unknown): string | undefined {
  if (result && typeof result === 'object' && 'id' in result) {
    return String((result as Record<string, unknown>)['id']);
  }
  return undefined;
}

/** Removes sensitive fields from audit data. */
function sanitizeForAudit(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const sanitized = { ...(data as Record<string, unknown>) };
  const sensitiveFields = ['passwordHash', 'password', 'refreshToken', 'accessToken', 'token'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}
