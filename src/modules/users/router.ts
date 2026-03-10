import { Router } from 'express';
import type { UsersController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { updateProfileSchema, avatarUploadSchema } from './dto.js';

/**
 * Creates the users router with all profile management endpoints.
 */
export function createUsersRouter(
  controller: UsersController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
  uploadLimiter: ReturnType<typeof import('express-rate-limit').default>,
): Router {
  const router = Router();

  // All routes require authentication
  router.use(authMiddleware);

  router.get('/me', controller.getProfile);
  router.patch('/me', validate(updateProfileSchema), controller.updateProfile);
  router.delete('/me', controller.deleteAccount);
  router.post('/me/avatar-upload-url', uploadLimiter, validate(avatarUploadSchema), controller.getAvatarUploadUrl);

  return router;
}
