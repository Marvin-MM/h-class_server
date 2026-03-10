import { z } from 'zod';

/** Schema for requesting a pre-signed upload URL. */
export const uploadUrlSchema = z.object({
  prefix: z.string().min(1, 'Prefix is required'),
  contentType: z.string().min(1, 'Content type is required'),
  fileName: z.string().min(1, 'File name is required'),
});

export type UploadUrlDto = z.infer<typeof uploadUrlSchema>;
