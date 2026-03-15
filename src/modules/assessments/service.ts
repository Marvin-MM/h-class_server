import type { AssessmentType } from "@prisma/client";
import type { AssessmentsRepository } from "./repository.js";
import type { CoursesRepository } from "../courses/repository.js";
import type { MediaService } from "../media/service.js";
import type { S3StorageClient } from "../../infrastructure/s3.js";
import type {
  CreateAssessmentDto,
  SubmitAssessmentDto,
  GradeSubmissionDto,
} from "./dto.js";
import type { AssessmentResponse, SubmissionResponse } from "./types.js";
import { ALLOWED_CONTENT_TYPES } from "../media/service.js";
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from "../../shared/errors/index.js";
import { eventBus, AppEvents } from "../../shared/utils/event-bus.js";
import { logger } from "../../shared/utils/logger.js";

export class AssessmentsService {
  constructor(
    private readonly assessmentsRepository: AssessmentsRepository,
    private readonly coursesRepository: CoursesRepository,
    private readonly mediaService: MediaService,
    private readonly s3Client: S3StorageClient,
  ) {}

  // ─── Assessment Upload URL (Tutor uploads question/instruction file) ───────

  /** Generates a pre-signed upload URL for an assessment file. */
  async getAssessmentUploadUrl(
    tutorId: string,
    courseId: string,
    contentType: string,
    fileName: string,
  ) {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError("Course", courseId);
    if (course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only upload assessments for your own courses",
      );

    const prefix = `assessments/${courseId}`;

    return this.mediaService.generateUploadUrl({
      prefix,
      contentType,
      fileName,
      allowedContentTypes: [...ALLOWED_CONTENT_TYPES.notes], // Same document types as notes
      maxFileSizeMb: 50,
    });
  }

  // ─── Assessment CRUD ───────────────────────────────────────────────────────

  async createAssessment(
    tutorId: string,
    dto: CreateAssessmentDto,
  ): Promise<AssessmentResponse> {
    const course = await this.coursesRepository.findById(dto.courseId);
    if (!course) throw new NotFoundError("Course", dto.courseId);
    if (course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only create assessments for your own courses",
      );

    if (dto.type === "FINAL_ASSESSMENT") {
      const hasFinal = await this.assessmentsRepository.hasFinalAssessment(
        dto.courseId,
      );
      if (hasFinal)
        throw new ConflictError("This course already has a final assessment");
    }

    const assessment = await this.assessmentsRepository.create({
      courseId: dto.courseId,
      title: dto.title,
      type: dto.type as AssessmentType,
      s3Key: dto.s3Key,
    });

    logger.info("Assessment created", {
      assessmentId: assessment.id,
      type: dto.type,
    });
    return this.toAssessmentResponse(assessment);
  }

  /** Gets an assessment with a download URL for the file (if attached). */
  async getAssessment(
    assessmentId: string,
    userId: string,
  ): Promise<AssessmentResponse> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError("Assessment", assessmentId);

    // Verify access — tutor or enrolled student
    const course = await this.coursesRepository.findById(assessment.courseId);
    if (!course) throw new NotFoundError("Course", assessment.courseId);

    if (course.tutorId !== userId) {
      const enrollment = await this.coursesRepository.getEnrollment(
        userId,
        assessment.courseId,
      );
      if (!enrollment)
        throw new AuthorizationError("You must be enrolled in the course");
      if (
        assessment.type === "FINAL_ASSESSMENT" &&
        enrollment.paymentStatus === "PARTIAL"
      ) {
        throw new AuthorizationError(
          "You must complete your course payment to access the final assessment",
        );
      }
    }

    return this.toAssessmentResponseWithUrl(assessment);
  }

  /** Gets all assessments for a course with download URLs. */
  async getCourseAssessments(
    courseId: string,
    userId: string,
  ): Promise<AssessmentResponse[]> {
    // Verify access
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError("Course", courseId);

    if (course.tutorId !== userId) {
      const enrollment = await this.coursesRepository.getEnrollment(
        userId,
        courseId,
      );
      if (!enrollment)
        throw new AuthorizationError("You must be enrolled in the course");

      let assessments =
        await this.assessmentsRepository.findByCourseId(courseId);
      if (enrollment.paymentStatus === "PARTIAL") {
        // Filter out the final assessment so it doesn't even show up until paid, or return it mapped as inaccessible.
        // Returning them all but letting `getAssessment` block download is safer,
        // however we can throw if they try to fetch the list and it contains a final assessment?
        // Let's just filter it out for partial payments to hide it.
        assessments = assessments.filter((a) => a.type !== "FINAL_ASSESSMENT");
      }
      return Promise.all(
        assessments.map((a) => this.toAssessmentResponseWithUrl(a)),
      );
    }

    const assessments =
      await this.assessmentsRepository.findByCourseId(courseId);
    return Promise.all(
      assessments.map((a) => this.toAssessmentResponseWithUrl(a)),
    );
  }

  // ─── Submission Upload & Submit ────────────────────────────────────────────

  /** Generates a pre-signed S3 URL for a student to upload their submission. */
  async getSubmissionUploadUrl(
    assessmentId: string,
    studentId: string,
    contentType: string,
    fileName: string,
  ) {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError("Assessment", assessmentId);

    const enrollment = await this.coursesRepository.getEnrollment(
      studentId,
      assessment.courseId,
    );
    if (!enrollment)
      throw new AuthorizationError("You must be enrolled in the course");
    if (
      assessment.type === "FINAL_ASSESSMENT" &&
      enrollment.paymentStatus === "PARTIAL"
    ) {
      throw new AuthorizationError(
        "You must complete your course payment to access the final assessment",
      );
    }

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
  async submitAssessment(
    assessmentId: string,
    studentId: string,
    dto: SubmitAssessmentDto,
  ): Promise<SubmissionResponse> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError("Assessment", assessmentId);

    const enrollment = await this.coursesRepository.getEnrollment(
      studentId,
      assessment.courseId,
    );
    if (!enrollment)
      throw new AuthorizationError("You must be enrolled in the course");
    if (
      assessment.type === "FINAL_ASSESSMENT" &&
      enrollment.paymentStatus === "PARTIAL"
    ) {
      throw new AuthorizationError(
        "You must complete your course payment to access the final assessment",
      );
    }

    const submission = await this.assessmentsRepository.createSubmission({
      assessmentId,
      studentId,
      s3Key: dto.s3Key,
    });

    logger.info("Submission recorded", {
      submissionId: submission.id,
      assessmentId,
      studentId,
    });
    return this.toSubmissionResponse(submission);
  }

  // ─── Download URLs for Submissions ─────────────────────────────────────────

  /** Gets a download URL for a submission file. Accessible by the tutor or the student who submitted. */
  async getSubmissionDownloadUrl(
    submissionId: string,
    userId: string,
  ): Promise<{ downloadUrl: string }> {
    const submission =
      await this.assessmentsRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError("Submission", submissionId);

    const assessment = await this.assessmentsRepository.findById(
      submission.assessmentId,
    );
    if (!assessment)
      throw new NotFoundError("Assessment", submission.assessmentId);

    const course = await this.coursesRepository.findById(assessment.courseId);
    if (!course) throw new NotFoundError("Course", assessment.courseId);

    // Access: tutor of the course or the student who submitted
    if (course.tutorId !== userId && submission.studentId !== userId) {
      throw new AuthorizationError(
        "You can only download your own submissions or submissions for courses you tutor",
      );
    }

    const downloadUrl = await this.s3Client.generatePresignedGetUrl(
      submission.s3Key,
      604800, // 7 days
    );
    return { downloadUrl };
  }

  /** Gets all submissions for an assessment with download URLs. Tutor only. */
  async getAssessmentSubmissions(
    assessmentId: string,
    tutorId: string,
  ): Promise<SubmissionResponse[]> {
    const assessment = await this.assessmentsRepository.findById(assessmentId);
    if (!assessment) throw new NotFoundError("Assessment", assessmentId);

    const course = await this.coursesRepository.findById(assessment.courseId);
    if (!course || course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only view submissions for your own courses",
      );

    const submissions =
      await this.assessmentsRepository.findSubmissionsByAssessmentId(
        assessmentId,
      );
    return Promise.all(
      submissions.map((s) => this.toSubmissionResponseWithUrl(s)),
    );
  }

  // ─── Grading ───────────────────────────────────────────────────────────────

  /** Grades a submission. If FINAL_ASSESSMENT, checks certificate eligibility. */
  async gradeSubmission(
    submissionId: string,
    tutorId: string,
    dto: GradeSubmissionDto,
  ): Promise<SubmissionResponse> {
    const submission =
      await this.assessmentsRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError("Submission", submissionId);

    const assessment = await this.assessmentsRepository.findById(
      submission.assessmentId,
    );
    if (!assessment)
      throw new NotFoundError("Assessment", submission.assessmentId);

    const course = await this.coursesRepository.findById(assessment.courseId);
    if (!course || course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only grade submissions for your own courses",
      );

    const graded = await this.assessmentsRepository.gradeSubmission(
      submissionId,
      dto.score,
      dto.feedback,
    );

    eventBus.emit(AppEvents.ASSESSMENT_GRADED, {
      submissionId: graded.id,
      assessmentId: assessment.id,
      studentId: submission.studentId,
      courseId: assessment.courseId,
      score: dto.score,
    });

    if (assessment.type === "FINAL_ASSESSMENT") {
      await this.checkCertificateEligibility(
        submission.studentId,
        assessment.courseId,
        course.passMark,
      );
    }

    logger.info("Submission graded", { submissionId, score: dto.score });
    return this.toSubmissionResponseWithUrl(graded);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async checkCertificateEligibility(
    studentId: string,
    courseId: string,
    passMark: unknown,
  ): Promise<void> {
    const { assessments, submissions } =
      await this.assessmentsRepository.getStudentCourseSubmissions(
        courseId,
        studentId,
      );

    if (submissions.length < assessments.length) return;

    const allGraded = submissions.every((s) => s.gradedAt !== null);
    if (!allGraded) return;

    const finalSubmission = submissions.find((s) => {
      const assessment = assessments.find((a) => a.id === s.assessmentId);
      return assessment?.type === "FINAL_ASSESSMENT";
    });

    if (!finalSubmission || finalSubmission.score === null) return;

    // We implement a rigorous auto-grading criteria compiling all module scores
    const totalScore = submissions.reduce((sum, s) => sum + Number(s.score || 0), 0);
    const overallScore = Number((totalScore / submissions.length).toFixed(2));
    const passMarkNum = Number(passMark);

    if (overallScore >= passMarkNum) {
      eventBus.emit(AppEvents.CERTIFICATE_ELIGIBLE, { studentId, courseId });
      logger.info("Certificate eligibility met", {
        studentId,
        courseId,
        overallScore,
        passMark: passMarkNum,
      });
    }
  }

  private toAssessmentResponse(a: {
    id: string;
    courseId: string;
    title: string;
    type: string;
    s3Key: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AssessmentResponse {
    return {
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      type: a.type,
      s3Key: a.s3Key,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private async toAssessmentResponseWithUrl(a: {
    id: string;
    courseId: string;
    title: string;
    type: string;
    s3Key: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AssessmentResponse> {
    const downloadUrl = a.s3Key
      ? await this.s3Client.generatePresignedGetUrl(a.s3Key, 604800) // 7 days
      : undefined;
    return {
      id: a.id,
      courseId: a.courseId,
      title: a.title,
      type: a.type,
      s3Key: a.s3Key,
      downloadUrl,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  private toSubmissionResponse(s: {
    id: string;
    assessmentId: string;
    studentId: string;
    s3Key: string;
    score: unknown;
    feedback: string | null;
    gradedAt: Date | null;
    createdAt: Date;
  }): SubmissionResponse {
    return {
      id: s.id,
      assessmentId: s.assessmentId,
      studentId: s.studentId,
      s3Key: s.s3Key,
      score: s.score !== null ? String(s.score) : null,
      feedback: s.feedback,
      gradedAt: s.gradedAt,
      createdAt: s.createdAt,
    };
  }

  private async toSubmissionResponseWithUrl(s: {
    id: string;
    assessmentId: string;
    studentId: string;
    s3Key: string;
    score: unknown;
    feedback: string | null;
    gradedAt: Date | null;
    createdAt: Date;
  }): Promise<SubmissionResponse> {
    const downloadUrl = await this.s3Client.generatePresignedGetUrl(
      s.s3Key,
      604800, // 7 days
    );
    return {
      id: s.id,
      assessmentId: s.assessmentId,
      studentId: s.studentId,
      s3Key: s.s3Key,
      downloadUrl,
      score: s.score !== null ? String(s.score) : null,
      feedback: s.feedback,
      gradedAt: s.gradedAt,
      createdAt: s.createdAt,
    };
  }
}
