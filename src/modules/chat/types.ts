/** Types for the Chat module. */
export interface ChatTokenResponse {
  readonly token: string;
  readonly userId: string;
}

export interface ChannelResponse {
  readonly id: string;
  readonly type: string;
  readonly courseId: string | null;
  readonly getStreamChannelId: string;
  readonly createdAt: Date;
}
