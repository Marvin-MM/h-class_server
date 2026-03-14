import { Router } from "express";
import type { PaymentsController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import {
  initiatePaymentSchema,
  initiateBalancePaymentSchema,
  financialSummarySchema,
} from "./dto.js";
import { roleGuard } from "../../middleware/role-guard.js";

/**
 * Creates the payments router.
 */
export function createPaymentsRouter(
  controller: PaymentsController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // Students initiate payment (start Marz collection + enqueue BullMQ job)
  router.post(
    "/initiate",
    roleGuard("STUDENT"),
    validate(initiatePaymentSchema),
    controller.initiatePayment,
  );

  // Students pay remaining 40% balance
  router.post(
    "/initiate-balance",
    roleGuard("STUDENT"),
    validate(initiateBalancePaymentSchema),
    controller.initiateBalancePayment,
  );

  // Any authenticated user can see their own transactions
  router.get("/transactions", controller.getTransactions);

  // Admin: financial summary
  router.get(
    "/summary",
    roleGuard("ADMIN"),
    validate(financialSummarySchema, "query"),
    controller.getFinancialSummary,
  );

  return router;
}
