export interface CertificateResponse {
  readonly id: string;
  readonly studentId: string;
  readonly courseId: string;
  readonly status: string;
  readonly data: Record<string, unknown> | null;
  readonly certificateUid: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
