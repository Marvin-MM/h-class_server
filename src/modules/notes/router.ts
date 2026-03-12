import { Router } from "express";
import type { NotesController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { roleGuard } from "../../middleware/role-guard.js";
import { createNoteSchema, noteUploadUrlSchema } from "./dto.js";

export function createNotesRouter(
  controller: NotesController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
  uploadLimiter: ReturnType<typeof import("express-rate-limit").default>,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // Tutor creates and uploads notes
  router.post(
    "/upload-url",
    roleGuard("TUTOR"),
    uploadLimiter,
    validate(noteUploadUrlSchema),
    controller.getUploadUrl,
  );
  router.post(
    "/",
    roleGuard("TUTOR"),
    validate(createNoteSchema),
    controller.create,
  );

  // Students and tutors view/download notes
  router.get("/course/:courseId", controller.getByCourse);
  router.get("/:id/download", controller.getDownloadUrl);

  return router;
}
