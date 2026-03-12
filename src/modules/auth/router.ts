import { Router } from "express";
import type { AuthController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendOtpSchema,
} from "./dto.js";

/**
 * Creates the auth router with all authentication endpoints.
 *
 * @param controller - The auth controller instance
 * @param authMiddleware - The authentication middleware function
 * @param authLimiter - Rate limiter for auth endpoints
 */
export function createAuthRouter(
  controller: AuthController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
  authLimiter: ReturnType<typeof import("express-rate-limit").default>,
): Router {
  const router = Router();

  // ─── Public routes ─────────────────────────────────────────────────────────
  router.post(
    "/register",
    authLimiter,
    validate(registerSchema),
    controller.register,
  );
  router.post("/login", authLimiter, validate(loginSchema), controller.login);
  router.post("/refresh", controller.refresh);
  router.post(
    "/forgot-password",
    authLimiter,
    validate(forgotPasswordSchema),
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    authLimiter,
    validate(resetPasswordSchema),
    controller.resetPassword,
  );
  router.post(
    "/resend-otp",
    authLimiter,
    validate(resendOtpSchema),
    controller.resendOtp,
  );

  // ─── Authenticated routes ──────────────────────────────────────────────────
  router.post("/logout", authMiddleware, controller.logout);
  router.post(
    "/verify-email",
    authMiddleware,
    validate(verifyEmailSchema),
    controller.verifyEmail,
  );
  router.post(
    "/change-password",
    authMiddleware,
    validate(changePasswordSchema),
    controller.changePassword,
  );
  router.post("/tutor-application", authMiddleware, controller.applyForTutor);

  return router;
}
