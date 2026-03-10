import { z } from 'zod';

/** Schema for updating user profile. */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/** Schema for requesting an avatar upload URL. */
export const avatarUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'] as const, {
    message: 'Content type must be image/jpeg, image/png, or image/webp',
  }),
  fileName: z.string().min(1, 'File name is required'),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type AvatarUploadDto = z.infer<typeof avatarUploadSchema>;
