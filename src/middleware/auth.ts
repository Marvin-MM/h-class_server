import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import { AuthenticationError } from '../shared/errors/index.js';
import type { AppConfig } from '../config/index.js';

/** JWT access token payload shape. */
export interface JwtPayload {
  userId: string;
  sessionId: string;
  role: string;
}

/**
 * Creates authentication middleware that validates JWT access tokens
 * and verifies that the session still exists in Redis (single-device enforcement).
 */
export function createAuthMiddleware(config: AppConfig, redisClient: Redis) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.accessToken as string | undefined;

      if (!token) {
        throw new AuthenticationError('Access token is required');
      }

      const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

      // Check Redis to confirm the session still exists (single-device enforcement)
      const sessionData = await redisClient.get(`session:${decoded.sessionId}`);
      if (!sessionData) {
        // Session was invalidated (logged out or replaced by another device)
        _res.clearCookie('accessToken');
        _res.clearCookie('refreshToken');
        throw new AuthenticationError('Session expired or invalidated');
      }

      // Attach user info to request
      req.user = {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        role: decoded.role,
      };

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        next(error);
        return;
      }
      if (error instanceof jwt.JsonWebTokenError) {
        next(new AuthenticationError('Invalid access token'));
        return;
      }
      if (error instanceof jwt.TokenExpiredError) {
        next(new AuthenticationError('Access token expired'));
        return;
      }
      next(error);
    }
  };
}
