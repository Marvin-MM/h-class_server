import { Router } from 'express';
import type { CertificatesController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { certificateIdParamSchema } from './dto.js';

export function createCertificatesRouter(
  controller: CertificatesController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/my', controller.getMy);
  router.get('/:id', validate(certificateIdParamSchema, 'params'), controller.getById);

  return router;
}
