import { Router } from "express";
import express from "express";
import type { PaymentsController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { connectOnboardingSchema, listTransactionsSchema } from "./dto.js";
import { roleGuard } from "../../middleware/role-guard.js";

/**
 * Creates the payments router.
 * NOTE: The webhook route uses express.raw() instead of express.json()
 * because Stripe requires the raw body for signature verification.
 */
export function createPaymentsRouter(
  controller: PaymentsController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
): Router {
  const router = Router();

  // Webhook route — MUST use raw body parser, not JSON
  router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    controller.handleWebhook,
  );

  // Authenticated routes
  router.post(
    "/connect/onboarding",
    authMiddleware,
    roleGuard("TUTOR"),
    validate(connectOnboardingSchema),
    controller.connectOnboarding,
  );

  router.get(
    "/transactions",
    authMiddleware,
    validate(listTransactionsSchema, "query"),
    controller.getTransactions,
  );

  return router;
}
