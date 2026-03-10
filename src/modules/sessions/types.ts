/** Types specific to the Sessions module. */
export interface SessionResponse {
  readonly id: string;
  readonly courseId: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly duration: number;
  readonly status: string;
  readonly getStreamCallId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface JoinSessionResult {
  readonly token: string;
  readonly callId: string;
}
