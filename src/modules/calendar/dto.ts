import { z } from "zod";

export const calendarQuerySchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type CalendarQueryDto = z.infer<typeof calendarQuerySchema>;
