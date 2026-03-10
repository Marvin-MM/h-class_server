import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from './service.js';
import type { RegisterDto, LoginDto } from './dto.js';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../shared/utils/response.js';

/**
 * Controller for authentication endpoints.
 * Handles HTTP concerns only — delegates all business logic to AuthService.
 */
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: AppConfig,
  ) {}

  /**
   * POST /auth/register
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as RegisterDto;
      const user = await this.authService.register(dto);
      sendSuccess(res, user, 201);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/login
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as LoginDto;
      const result = await this.authService.login(dto);

      // Set HttpOnly cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh', // Only sent on refresh requests
      });

      sendSuccess(res, { user: result.user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/refresh
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const oldRefreshToken = req.cookies?.refreshToken as string | undefined;
      if (!oldRefreshToken) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTHENTICATION_ERROR', message: 'Refresh token is required' },
        });
        return;
      }

      const tokens = await this.authService.refreshTokens(oldRefreshToken);

      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh',
      });

      sendSuccess(res, { message: 'Tokens refreshed' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/logout
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) {
        await this.authService.logout(req.user.sessionId, req.user.userId);
      }

      res.clearCookie('accessToken', { domain: this.config.COOKIE_DOMAIN });
      res.clearCookie('refreshToken', { domain: this.config.COOKIE_DOMAIN, path: '/api/auth/refresh' });

      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/tutor-application
   */
  applyForTutor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.applyForTutor(req.user!.userId, req.user!.role);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };
}
