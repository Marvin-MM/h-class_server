import type { Request, Response, NextFunction } from 'express';
import { asyncContext } from '../shared/utils/async-context.js';

/**
 * Middleware that wraps each request in an AsyncLocalStorage context.
 * This enables the audit Prisma middleware to access the current actor
 * without being passed the request object explicitly.
 */
export function asyncContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const context = {
    actorId: req.user?.userId ?? null,
    requestId: req.requestId ?? 'unknown',
  };

  asyncContext.run(context, () => {
    next();
  });
}
