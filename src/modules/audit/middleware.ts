import { Prisma, PrismaClient } from "@prisma/client";
import { asyncContext } from "../../shared/utils/async-context.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Prisma Client Extension for automatic audit logging.
 * Replaces the deprecated $use() middleware with the Client Extensions API.
 * Captures create/update/delete operations on watched models
 * and writes immutable AuditLog records tagged with the actor from AsyncLocalStorage.
 */

/** Models to track in the audit log. */
const AUDITED_MODELS = new Set([
  "User",
  "Course",
  "Enrollment",
  "Session",
  "Note",
  "Assessment",
  "Submission",
  "Certificate",
  "Transaction",
  "TutorApplication",
  "Domain",
  "AppConfig",
]);

const ACTION_MAP: Record<string, string> = {
  create: "CREATE",
  update: "UPDATE",
  delete: "DELETE",
  upsert: "UPSERT",
};

/**
 * Creates a Prisma Client extended with audit logging.
 * All create/update/delete operations on audited models are automatically logged.
 */
export function withAuditLogging(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          await logAudit(prisma, model, "create", args, result);
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          await logAudit(prisma, model, "update", args, result);
          return result;
        },
        async delete({ model, args, query }) {
          const result = await query(args);
          await logAudit(prisma, model, "delete", args, result);
          return result;
        },
        async upsert({ model, args, query }) {
          const result = await query(args);
          await logAudit(prisma, model, "upsert", args, result);
          return result;
        },
      },
    },
  });
}

async function logAudit(
  prisma: PrismaClient,
  model: string | undefined,
  action: string,
  args: Record<string, unknown>,
  result: unknown,
): Promise<void> {
  if (!model || !AUDITED_MODELS.has(model)) return;
  const mappedAction = ACTION_MAP[action];
  if (!mappedAction) return;

  const ctx = asyncContext.getStore();
  const actorId = ctx?.actorId ?? undefined;

  try {
    const resourceId = extractResourceId(result);

    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: mappedAction,
        resourceType: model,
        resourceId: resourceId ?? "unknown",
        before: action === "update" ? JSON.stringify(args["where"]) : undefined,
        after: result ? JSON.stringify(sanitizeForAudit(result)) : undefined,
      },
    });
  } catch (error) {
    // Never let audit failures break the main operation
    logger.error("Failed to write audit log", {
      error,
      model,
      action: mappedAction,
    });
  }
}

function extractResourceId(result: unknown): string | undefined {
  if (result && typeof result === "object" && "id" in result) {
    return String((result as Record<string, unknown>)["id"]);
  }
  return undefined;
}

/** Removes sensitive fields from audit data. */
function sanitizeForAudit(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const sanitized = { ...(data as Record<string, unknown>) };
  const sensitiveFields = [
    "passwordHash",
    "password",
    "refreshToken",
    "accessToken",
    "token",
  ];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }
  return sanitized;
}
