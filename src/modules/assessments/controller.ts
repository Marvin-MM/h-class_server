import type { Request, Response, NextFunction } from "express";
import type { AssessmentsService } from "./service.js";
import type {
  CreateAssessmentDto,
  SubmitAssessmentDto,
  GradeSubmissionDto,
  AssessmentUploadUrlDto,
} from "./dto.js";
import { sendSuccess } from "../../shared/utils/response.js";

export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  /** POST /assessments/upload-url — Get a pre-signed URL for uploading an assessment file (tutor only). */
  getUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as AssessmentUploadUrlDto;
      const result = await this.assessmentsService.getAssessmentUploadUrl(
        req.user!.userId,
        dto.courseId,
        dto.contentType,
        dto.fileName,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** POST /assessments — Create an assessment record (tutor only). */
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.assessmentsService.createAssessment(
        req.user!.userId,
        req.body as CreateAssessmentDto,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  /** GET /assessments/:id — Get a single assessment with download URL. */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.assessmentsService.getAssessment(
          String(req.params["id"]),
          req.user!.userId,
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  /** GET /assessments/course/:courseId — Get all assessments for a course with download URLs. */
  getByCourse = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.assessmentsService.getCourseAssessments(
          String(req.params["courseId"]),
          req.user!.userId,
        ),
      );
    } catch (error) {
      next(error);
    }
  };

  /** POST /assessments/:id/submit-url — Get upload URL for submission file (student only). */
  getSubmitUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.assessmentsService.getSubmissionUploadUrl(
        String(req.params["id"]),
        req.user!.userId,
        req.body.contentType as string,
        req.body.fileName as string,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** POST /assessments/:id/submit — Record a submission (student only). */
  submit = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.assessmentsService.submitAssessment(
        String(req.params["id"]),
        req.user!.userId,
        req.body as SubmitAssessmentDto,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  /** GET /assessments/:id/submissions — Get all submissions for an assessment (tutor only). */
  getSubmissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const submissions =
        await this.assessmentsService.getAssessmentSubmissions(
          String(req.params["id"]),
          req.user!.userId,
        );
      sendSuccess(res, submissions);
    } catch (error) {
      next(error);
    }
  };

  /** GET /assessments/submissions/:id/download — Get download URL for a submission file. */
  getSubmissionDownloadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.assessmentsService.getSubmissionDownloadUrl(
        String(req.params["id"]),
        req.user!.userId,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** POST /assessments/submissions/:id/grade — Grade a submission (tutor only). */
  grade = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.assessmentsService.gradeSubmission(
        String(req.params["id"]),
        req.user!.userId,
        req.body as GradeSubmissionDto,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
