import { z } from 'zod';
export const registerPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['android', 'ios', 'web']),
});
export const notificationIdParamSchema = z.object({ id: z.string().uuid() });
export type RegisterPushTokenDto = z.infer<typeof registerPushTokenSchema>;
