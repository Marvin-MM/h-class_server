import type { Request, Response, NextFunction } from 'express';
import type { AssessmentsService } from './service.js';
import type { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto } from './dto.js';
import { sendSuccess } from '../../shared/utils/response.js';

export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.assessmentsService.createAssessment(req.user!.userId, req.body as CreateAssessmentDto);
      sendSuccess(res, result, 201);
    } catch (error) { next(error); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.assessmentsService.getAssessment(String(req.params['id'])));
    } catch (error) { next(error); }
  };

  getByCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.assessmentsService.getCourseAssessments(String(req.params['courseId'])));
    } catch (error) { next(error); }
  };

  getSubmitUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.assessmentsService.getSubmissionUploadUrl(
        String(req.params['id']), req.user!.userId,
        req.body.contentType as string, req.body.fileName as string,
      );
      sendSuccess(res, result);
    } catch (error) { next(error); }
  };

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.assessmentsService.submitAssessment(String(req.params['id']), req.user!.userId, req.body as SubmitAssessmentDto);
      sendSuccess(res, result, 201);
    } catch (error) { next(error); }
  };

  grade = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.assessmentsService.gradeSubmission(String(req.params['id']), req.user!.userId, req.body as GradeSubmissionDto);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  };
}
