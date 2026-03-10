import { z } from 'zod';

export const createSessionSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  title: z.string().min(3).max(200),
  scheduledAt: z.coerce.date().refine((d) => d > new Date(), 'Scheduled time must be in the future'),
  duration: z.number().int().min(15).max(480),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
