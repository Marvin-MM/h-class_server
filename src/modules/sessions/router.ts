import { Router } from 'express';
import type { SessionsController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { createSessionSchema, sessionIdParamSchema } from './dto.js';

export function createSessionsRouter(
  controller: SessionsController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
): Router {
  const router = Router();
  router.use(authMiddleware);

  router.post('/', roleGuard('TUTOR'), validate(createSessionSchema), controller.create);
  router.get('/course/:courseId', controller.getByCourse);
  router.get('/:id', validate(sessionIdParamSchema, 'params'), controller.getById);
  router.post('/:id/start', roleGuard('TUTOR'), validate(sessionIdParamSchema, 'params'), controller.start);
  router.post('/:id/end', roleGuard('TUTOR'), validate(sessionIdParamSchema, 'params'), controller.end);
  router.post('/:id/join', validate(sessionIdParamSchema, 'params'), controller.join);

  return router;
}
