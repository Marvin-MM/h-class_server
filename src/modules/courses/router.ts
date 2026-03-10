import { Router } from 'express';
import type { CoursesController } from './controller.js';
import { validate } from '../../middleware/validate.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { createCourseSchema, updateCourseSchema, listCoursesSchema, courseIdParamSchema } from './dto.js';

/**
 * Creates the courses router with all course management endpoints.
 */
export function createCoursesRouter(
  controller: CoursesController,
  authMiddleware: ReturnType<typeof import('../../middleware/auth.js').createAuthMiddleware>,
): Router {
  const router = Router();

  // Public: list & get courses (no auth required for browsing)
  router.get('/', validate(listCoursesSchema, 'query'), controller.list);
  router.get('/my-enrollments', authMiddleware, controller.getMyEnrollments);
  router.get('/:id', validate(courseIdParamSchema, 'params'), controller.getById);

  // Authenticated routes
  router.post('/', authMiddleware, roleGuard('TUTOR'), validate(createCourseSchema), controller.create);
  router.patch('/:id', authMiddleware, roleGuard('TUTOR'), validate(courseIdParamSchema, 'params'), validate(updateCourseSchema), controller.update);
  router.post('/:id/publish', authMiddleware, roleGuard('TUTOR'), validate(courseIdParamSchema, 'params'), controller.publish);
  router.post('/:id/complete', authMiddleware, roleGuard('TUTOR'), validate(courseIdParamSchema, 'params'), controller.complete);
  router.post('/:id/archive', authMiddleware, roleGuard('ADMIN'), validate(courseIdParamSchema, 'params'), controller.archive);
  router.post('/:id/enroll', authMiddleware, roleGuard('STUDENT'), validate(courseIdParamSchema, 'params'), controller.enroll);
  router.get('/:id/students', authMiddleware, roleGuard('TUTOR'), validate(courseIdParamSchema, 'params'), controller.getStudents);

  return router;
}
