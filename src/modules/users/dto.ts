import { z } from "zod";

/** Schema for updating user profile. */
export const updateProfileSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    avatarUrl: z.string().url().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
