import { Router } from 'express';
import type { AuthController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { registerSchema, loginSchema } from './dto.js';

/**
 * Creates the auth router with all authentication endpoints.
 *
 * @param controller - The auth controller instance
 * @param authMiddleware - The authentication middleware function
 * @param authLimiter - Rate limiter for auth endpoints
 */
export function createAuthRouter(
  controller: AuthController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
  authLimiter: ReturnType<typeof import('express-rate-limit').default>,
): Router {
  const router = Router();

  router.post('/register', authLimiter, validate(registerSchema), controller.register);
  router.post('/login', authLimiter, validate(loginSchema), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', authMiddleware, controller.logout);
  router.post('/tutor-application', authMiddleware, controller.applyForTutor);

  return router;
}
