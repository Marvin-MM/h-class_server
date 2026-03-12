import { z } from "zod";

export const createConversationSchema = z.object({
  type: z.enum(["DIRECT", "COURSE", "SUPPORT"]),
  courseId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(), // For DIRECT channels
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
