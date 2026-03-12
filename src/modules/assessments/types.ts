export interface AssessmentResponse {
  readonly id: string;
  readonly courseId: string;
  readonly title: string;
  readonly type: string;
  readonly s3Key: string | null;
  readonly downloadUrl?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SubmissionResponse {
  readonly id: string;
  readonly assessmentId: string;
  readonly studentId: string;
  readonly s3Key: string;
  readonly downloadUrl?: string;
  readonly score: string | null;
  readonly feedback: string | null;
  readonly gradedAt: Date | null;
  readonly createdAt: Date;
}
