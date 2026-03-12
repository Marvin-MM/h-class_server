import { z } from "zod";

export const createSessionSchema = z
  .object({
    courseId: z.string().uuid("Invalid course ID"),
    title: z.string().min(3).max(200),
    scheduledAt: z.coerce
      .date()
      .refine((d) => d > new Date(), "Scheduled time must be in the future"),
    duration: z.number().int().min(15).max(180).optional(),
    endTime: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.endTime) {
        const diffMins =
          (data.endTime.getTime() - data.scheduledAt.getTime()) / 60000;
        return diffMins >= 15 && diffMins <= 180;
      }
      return true;
    },
    {
      message:
        "Session duration must be between 15 minutes and 3 hours based on start and end times",
    },
  );

export const sessionIdParamSchema = z.object({
  id: z.string().uuid("Invalid session ID"),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
