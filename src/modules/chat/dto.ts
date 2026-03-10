import { z } from 'zod';

export const createChannelSchema = z.object({
  type: z.enum(['STUDENT_TUTOR', 'COURSE_SUPPORT', 'SUPPORT']),
  courseId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(), // For STUDENT_TUTOR channels
});

export type CreateChannelDto = z.infer<typeof createChannelSchema>;
