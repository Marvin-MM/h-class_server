import type { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '../shared/errors/index.js';

/**
 * Creates a middleware that restricts access to users with specific roles.
 * Must be used after the auth middleware which attaches req.user.
 *
 * @param roles - One or more roles that are allowed to access the route
 */
export function roleGuard(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthorizationError('Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AuthorizationError(`This action requires one of the following roles: ${roles.join(', ')}`));
      return;
    }

    next();
  };
}
