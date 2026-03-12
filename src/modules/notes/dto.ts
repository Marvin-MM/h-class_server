import { z } from "zod";

export const createNoteSchema = z.object({
  courseId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  s3Key: z.string().min(1, "S3 key is required"),
});

export const noteUploadUrlSchema = z.object({
  courseId: z.string().uuid(),
  contentType: z.string().min(1, "Content type is required"),
  fileName: z.string().min(1, "File name is required"),
});

export type CreateNoteDto = z.infer<typeof createNoteSchema>;
export type NoteUploadUrlDto = z.infer<typeof noteUploadUrlSchema>;
