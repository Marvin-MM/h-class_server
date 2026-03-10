import type { AssessmentType } from '@prisma/client';
import type { AssessmentsRepository } from './repository.js';
import type { CoursesRepository } from '../courses/repository.js';
import type { MediaService } from '../media/service.js';
import type { CreateAssessmentDto, SubmitAssessmentDto, GradeSubmissionDto } from './dto.js';
import type { AssessmentResponse, SubmissionResponse } from './types.js';
import { ALLOWED_CONTENT_TYPES } from '../media/service.js';
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../../shared/errors/index.js';
import { eventBus, AppEvents } from '../../shared/utils/event-bus.js';
import { logger } from '../../shared/utils/logger.js';

export class AssessmentsService {
  constructor(
    private readonly assessmentsRepository: AssessmentsRepository,
    private readonly coursesRepository: CoursesRepository,
    private readonly mediaService: MediaService,
  ) {}

  async createAssessment(tutorId: string, dto: CreateAssessmentDto): Promise<AssessmentResponse> {
    const course = await this.coursesRepository.findById(dto.courseId);
    if (!course) throw new NotFoundError('Course', dto.courseId);
    if (course.tutorId !== tutorId) throw new AuthorizationError('You can only create assessments for your own courses');

    // Enforce single FINAL_ASSESSMENT per course
    if (dto.type === 'FINAL_ASSESSMENT') {
      const hasFinal = await this.assessmentsRepository.hasFinalAssessment(dto.courseId);
      if (hasFinal) throw new ConflictError('This course already has a final assessment');
    }

    const assessment = await this.assessmentsRepository.create({
      courseId: dto.courseId,
      title: dto.title,
      type: dto.type as AssessmentType,
    });

    logger.info('Assessment created', { assessmentId: assessment.id, type: dto.type });
    return this.toAssessmentResponse(assessment);
  }

  async getAssessment(assessmentId: string): Promise<AssessmentResponse> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment', assessmentId);
    return this.toAssessmentResponse(assessment);
  }

  async getCourseAssessments(courseId: string): Promise<AssessmentResponse[]> {
    const assessments = await this.assessmentsRepository.findByCourseId(courseId);
    return assessments.map(this.toAssessmentResponse);
  }

  /** Generates a pre-signed S3 URL for submission upload. */
  async getSubmissionUploadUrl(assessmentId: string, studentId: string, contentType: string, fileName: string) {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment', assessmentId);

    // Verify enrollment
    const isEnrolled = await this.coursesRepository.isEnrolled(studentId, assessment.courseId);
    if (!isEnrolled) throw new AuthorizationError('You must be enrolled in the course');

    // Scoped S3 key
    const prefix = `submissions/${assessment.courseId}/${assessmentId}/${studentId}`;

    return this.mediaService.generateUploadUrl({
      prefix,
      contentType,
      fileName,
      allowedContentTypes: [...ALLOWED_CONTENT_TYPES.submissions],
      maxFileSizeMb: 50,
    });
  }

  /** Records a submission after the student has uploaded to S3. */
  async submitAssessment(assessmentId: string, studentId: string, dto: SubmitAssessmentDto): Promise<SubmissionResponse> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment', assessmentId);

    const isEnrolled = await this.coursesRepository.isEnrolled(studentId, assessment.courseId);
    if (!isEnrolled) throw new AuthorizationError('You must be enrolled in the course');

    const submission = await this.assessmentsRepository.createSubmission({
      assessmentId,
      studentId,
      s3Key: dto.s3Key,
    });

    logger.info('Submission recorded', { submissionId: submission.id, assessmentId, studentId });
    return this.toSubmissionResponse(submission);
  }

  /** Grades a submission. If FINAL_ASSESSMENT, checks certificate eligibility. */
  async gradeSubmission(submissionId: string, tutorId: string, dto: GradeSubmissionDto): Promise<SubmissionResponse> {
    const submission = await this.assessmentsRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('Submission', submissionId);

    const assessment = await this.assessmentsRepository.findById(submission.assessmentId);
    if (!assessment) throw new NotFoundError('Assessment', submission.assessmentId);

    const course = await this.coursesRepository.findById(assessment.courseId);
    if (!course || course.tutorId !== tutorId) throw new AuthorizationError('You can only grade submissions for your own courses');

    const graded = await this.assessmentsRepository.gradeSubmission(submissionId, dto.score, dto.feedback);

    eventBus.emit(AppEvents.ASSESSMENT_GRADED, {
      submissionId: graded.id,
      assessmentId: assessment.id,
      studentId: submission.studentId,
      courseId: assessment.courseId,
      score: dto.score,
    });

    // Certificate eligibility check for FINAL_ASSESSMENT
    if (assessment.type === 'FINAL_ASSESSMENT') {
      await this.checkCertificateEligibility(submission.studentId, assessment.courseId, course.passMark);
    }

    logger.info('Submission graded', { submissionId, score: dto.score });
    return this.toSubmissionResponse(graded);
  }

  /** Checks if a student has submitted all assessments and meets the pass mark. */
  private async checkCertificateEligibility(studentId: string, courseId: string, passMark: unknown): Promise<void> {
    const { assessments, submissions } = await this.assessmentsRepository.getStudentCourseSubmissions(courseId, studentId);

    // Check all assessments are submitted
    if (submissions.length < assessments.length) return;

    // Check all are graded
    const allGraded = submissions.every((s) => s.gradedAt !== null);
    if (!allGraded) return;

    // Check final score meets pass mark
    const finalSubmission = submissions.find((s) => {
      const assessment = assessments.find((a) => a.id === s.assessmentId);
      return assessment?.type === 'FINAL_ASSESSMENT';
    });

    if (!finalSubmission || finalSubmission.score === null) return;

    const finalScore = Number(finalSubmission.score);
    const passMarkNum = Number(passMark);

    if (finalScore >= passMarkNum) {
      eventBus.emit(AppEvents.CERTIFICATE_ELIGIBLE, { studentId, courseId });
      logger.info('Certificate eligibility met', { studentId, courseId, finalScore, passMark: passMarkNum });
    }
  }

  private toAssessmentResponse(a: { id: string; courseId: string; title: string; type: string; createdAt: Date; updatedAt: Date }): AssessmentResponse {
    return { id: a.id, courseId: a.courseId, title: a.title, type: a.type, createdAt: a.createdAt, updatedAt: a.updatedAt };
  }

  private toSubmissionResponse(s: { id: string; assessmentId: string; studentId: string; s3Key: string; score: unknown; feedback: string | null; gradedAt: Date | null; createdAt: Date }): SubmissionResponse {
    return { id: s.id, assessmentId: s.assessmentId, studentId: s.studentId, s3Key: s.s3Key, score: s.score !== null ? String(s.score) : null, feedback: s.feedback, gradedAt: s.gradedAt, createdAt: s.createdAt };
  }
}
