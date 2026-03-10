import { Router } from 'express';
import type { NotesController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { createNoteSchema } from './dto.js';

export function createNotesRouter(
  controller: NotesController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
): Router {
  const router = Router();
  router.use(authMiddleware);

  router.post('/', roleGuard('TUTOR'), validate(createNoteSchema), controller.create);
  router.get('/course/:courseId', controller.getByCourse);

  return router;
}
