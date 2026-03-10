import { Router } from 'express';
import type { NotificationsController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { registerPushTokenSchema, notificationIdParamSchema } from './dto.js';

export function createNotificationsRouter(
  controller: NotificationsController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.get('/', controller.getNotifications);
  router.patch('/:id/read', validate(notificationIdParamSchema, 'params'), controller.markAsRead);
  router.post('/push-tokens', validate(registerPushTokenSchema), controller.registerPushToken);
  return router;
}
