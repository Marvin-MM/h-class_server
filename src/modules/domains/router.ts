import { Router } from 'express';
import type { DomainsController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { requestDomainSchema } from './dto.js';

export function createDomainsRouter(controller: DomainsController, authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>): Router {
  const router = Router();
  router.use(authMiddleware);
  router.post('/', validate(requestDomainSchema), controller.request);
  router.get('/me', controller.getMyDomain);
  return router;
}
