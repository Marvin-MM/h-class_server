import { Router } from "express";
import type { AssessmentsController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { roleGuard } from "../../middleware/role-guard.js";
import {
  createAssessmentSchema,
  submitAssessmentSchema,
  gradeSubmissionSchema,
  assessmentUploadUrlSchema,
  assessmentIdParamSchema,
  submissionIdParamSchema,
} from "./dto.js";

export function createAssessmentsRouter(
  controller: AssessmentsController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
  uploadLimiter: ReturnType<typeof import("express-rate-limit").default>,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // ─── Tutor: upload assessment file + create assessment ──────────────────────
  router.post(
    "/upload-url",
    roleGuard("TUTOR"),
    uploadLimiter,
    validate(assessmentUploadUrlSchema),
    controller.getUploadUrl,
  );
  router.post(
    "/",
    roleGuard("TUTOR"),
    validate(createAssessmentSchema),
    controller.create,
  );

  // ─── View assessments (tutor + enrolled students) ───────────────────────────
  router.get("/course/:courseId", controller.getByCourse);
  router.get(
    "/:id",
    validate(assessmentIdParamSchema, "params"),
    controller.getById,
  );

  // ─── Student: upload + submit answers ───────────────────────────────────────
  router.post(
    "/:id/submit-url",
    roleGuard("STUDENT"),
    uploadLimiter,
    validate(assessmentIdParamSchema, "params"),
    controller.getSubmitUrl,
  );
  router.post(
    "/:id/submit",
    roleGuard("STUDENT"),
    validate(assessmentIdParamSchema, "params"),
    validate(submitAssessmentSchema),
    controller.submit,
  );

  // ─── Tutor: view submissions + download + grade ─────────────────────────────
  router.get(
    "/:id/submissions",
    roleGuard("TUTOR"),
    validate(assessmentIdParamSchema, "params"),
    controller.getSubmissions,
  );
  router.get(
    "/submissions/:id/download",
    validate(submissionIdParamSchema, "params"),
    controller.getSubmissionDownloadUrl,
  );
  router.post(
    "/submissions/:id/grade",
    roleGuard("TUTOR"),
    validate(submissionIdParamSchema, "params"),
    validate(gradeSubmissionSchema),
    controller.grade,
  );

  return router;
}
