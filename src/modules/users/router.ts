import { Router } from "express";
import type { UsersController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { updateProfileSchema } from "./dto.js";
import { roleGuard } from "../../middleware/role-guard.js";
import multer from "multer";

// Use memory storage for direct buffer access
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/**
 * Creates the users router with all profile management endpoints.
 */
export function createUsersRouter(
  controller: UsersController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
  uploadLimiter: ReturnType<typeof import("express-rate-limit").default>,
): Router {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  // Admin-only: list users with optional role filter
  router.get("/", roleGuard("ADMIN"), controller.listUsers);

  router.get("/me", controller.getProfile);
  router.patch("/me", validate(updateProfileSchema), controller.updateProfile);
  router.delete("/me", controller.deleteAccount);
  router.post(
    "/me/avatar",
    uploadLimiter,
    upload.single("avatar"),
    controller.uploadAvatar,
  );

  return router;
}
