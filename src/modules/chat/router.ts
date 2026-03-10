import { Router } from 'express';
import type { ChatController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { createChannelSchema } from './dto.js';

export function createChatRouter(
  controller: ChatController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.get('/token', controller.getToken);
  router.post('/channels', validate(createChannelSchema), controller.createChannel);
  return router;
}
