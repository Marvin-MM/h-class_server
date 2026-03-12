import { Router } from "express";
import type { AdminController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { roleGuard } from "../../middleware/role-guard.js";
import {
  applicationActionSchema,
  createConfigSchema,
  updateConfigSchema,
  deleteConfigSchema,
  auditLogQuerySchema,
  financialSummaryQuerySchema,
} from "./dto.js";

export function createAdminRouter(
  controller: AdminController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
): Router {
  const router = Router();
  router.use(authMiddleware, roleGuard("ADMIN"));

  // ─── Tutor Applications ────────────────────────────────────────────────────
  router.get("/applications", controller.getApplications);
  router.post("/applications/:id/approve", controller.approveApplication);
  router.post(
    "/applications/:id/deny",
    validate(applicationActionSchema),
    controller.denyApplication,
  );

  // ─── Platform Configuration ────────────────────────────────────────────────
  router.get("/config", controller.getConfig);
  router.post("/config", validate(createConfigSchema), controller.createConfig);
  router.patch(
    "/config",
    validate(updateConfigSchema),
    controller.updateConfig,
  );
  router.delete(
    "/config",
    validate(deleteConfigSchema),
    controller.deleteConfig,
  );

  // ─── Audit & Financial ─────────────────────────────────────────────────────
  router.get(
    "/audit-logs",
    validate(auditLogQuerySchema, "query"),
    controller.getAuditLogs,
  );
  router.get(
    "/financial-summary",
    validate(financialSummaryQuerySchema, "query"),
    controller.getFinancialSummary,
  );

  return router;
}
