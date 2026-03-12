import { z } from "zod";

export const certificateIdParamSchema = z.object({ id: z.string().uuid() });
