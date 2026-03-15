import { Router } from "express";
import type { NotesController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { roleGuard } from "../../middleware/role-guard.js";
import { createNoteSchema, noteUploadUrlSchema } from "./dto.js";
import multer from "multer";

export function createNotesRouter(
  controller: NotesController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
  uploadLimiter: ReturnType<typeof import("express-rate-limit").default>,
): Router {
  const router = Router();
  router.use(authMiddleware);

  const upload = multer();

  // Tutor creates and uploads notes
  router.post(
    "/upload-url",
    roleGuard("TUTOR"),
    uploadLimiter,
    upload.none(),
    validate(noteUploadUrlSchema),
    controller.getUploadUrl,
  );
  router.post(
    "/",
    roleGuard("TUTOR"),
    upload.none(),
    validate(createNoteSchema),
    controller.create,
  );

  // Students and tutors view/download notes
  router.get("/course/:courseId", controller.getByCourse);
  router.get("/:id/download", controller.getDownloadUrl);

  return router;
}
