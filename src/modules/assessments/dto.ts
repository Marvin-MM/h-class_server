import { z } from "zod";

export const createAssessmentSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(3).max(200),
  type: z.enum(["MODULE_QUIZ", "ASSIGNMENT", "FINAL_ASSESSMENT"]),
  s3Key: z.string().min(1, "Assessment file S3 key is required").optional(),
});

export const submitAssessmentSchema = z.object({
  s3Key: z.string().min(1, "S3 key is required"),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().max(5000).optional(),
});

export const assessmentUploadUrlSchema = z.object({
  courseId: z.string().uuid(),
  contentType: z.string().min(1, "Content type is required"),
  fileName: z.string().min(1, "File name is required"),
});

export const assessmentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const submissionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateAssessmentDto = z.infer<typeof createAssessmentSchema>;
export type SubmitAssessmentDto = z.infer<typeof submitAssessmentSchema>;
export type GradeSubmissionDto = z.infer<typeof gradeSubmissionSchema>;
export type AssessmentUploadUrlDto = z.infer<typeof assessmentUploadUrlSchema>;
