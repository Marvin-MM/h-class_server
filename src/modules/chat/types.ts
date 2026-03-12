/** Types for the Chat module. */
export interface ConversationResponse {
  readonly id: string;
  readonly type: string;
  readonly courseId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly participants?: unknown[];
  readonly course?: unknown;
}

export interface MessageResponse {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly content: string;
  readonly createdAt: Date;
}
