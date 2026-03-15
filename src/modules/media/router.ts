import { Router } from "express";
import type { MediaController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { uploadUrlSchema } from "./dto.js";
import multer from "multer";

/**
 * Creates the media router.
 */
export function createMediaRouter(
  controller: MediaController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
  uploadLimiter: ReturnType<typeof import("express-rate-limit").default>,
): Router {
  const router = Router();

  const upload = multer();

  router.use(authMiddleware);
  router.post(
    "/upload-url",
    uploadLimiter,
    upload.none(),
    validate(uploadUrlSchema),
    controller.getUploadUrl,
  );

  return router;
}
