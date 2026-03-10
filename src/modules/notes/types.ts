export interface NoteResponse {
  readonly id: string;
  readonly courseId: string;
  readonly sessionId: string | null;
  readonly tutorId: string;
  readonly title: string;
  readonly s3Key: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
