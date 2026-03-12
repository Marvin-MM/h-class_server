import type { Request, Response, NextFunction } from "express";
import type { AuthService } from "./service.js";
import type {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendOtpDto,
} from "./dto.js";
import type { AppConfig } from "../../config/index.js";
import { sendSuccess } from "../../shared/utils/response.js";

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
  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
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
  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as LoginDto;
      const result = await this.authService.login(dto);

      // Set HttpOnly cookies
      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === "production",
        sameSite: "strict",
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === "production",
        sameSite: "strict",
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/api/auth/refresh", // Only sent on refresh requests
      });

      sendSuccess(res, { user: result.user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/refresh
   */
  refresh = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const oldRefreshToken = req.cookies?.refreshToken as string | undefined;
      if (!oldRefreshToken) {
        res.status(401).json({
          success: false,
          error: {
            code: "AUTHENTICATION_ERROR",
            message: "Refresh token is required",
          },
        });
        return;
      }

      const tokens = await this.authService.refreshTokens(oldRefreshToken);

      res.cookie("accessToken", tokens.accessToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === "production",
        sameSite: "strict",
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: this.config.NODE_ENV === "production",
        sameSite: "strict",
        domain: this.config.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/auth/refresh",
      });

      sendSuccess(res, { message: "Tokens refreshed" });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/logout
   */
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (req.user) {
        await this.authService.logout(req.user.sessionId, req.user.userId);
      }

      res.clearCookie("accessToken", { domain: this.config.COOKIE_DOMAIN });
      res.clearCookie("refreshToken", {
        domain: this.config.COOKIE_DOMAIN,
        path: "/api/auth/refresh",
      });

      sendSuccess(res, { message: "Logged out successfully" });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/verify-email
   * Authenticated — verifies the logged-in user's email with an OTP.
   */
  verifyEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as VerifyEmailDto;
      await this.authService.verifyEmail(req.user!.userId, dto.otp);
      sendSuccess(res, { message: "Email verified successfully" });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/resend-otp
   * Resends an OTP. For email verification (authenticated), for password reset (public).
   */
  resendOtp = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as ResendOtpDto;

      if (dto.type === "email_verification") {
        // Must be authenticated
        if (!req.user) {
          res.status(401).json({
            success: false,
            error: {
              code: "AUTHENTICATION_ERROR",
              message: "Authentication required",
            },
          });
          return;
        }
        await this.authService.resendVerificationOtp(req.user.userId);
      } else {
        // password_reset — works for any email
        await this.authService.forgotPassword(dto.email);
      }

      sendSuccess(res, { message: "OTP sent successfully" });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/change-password
   * Authenticated — changes the logged-in user's password.
   */
  changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as ChangePasswordDto;
      await this.authService.changePassword(req.user!.userId, dto);

      // Clear cookies since sessions are invalidated
      res.clearCookie("accessToken", { domain: this.config.COOKIE_DOMAIN });
      res.clearCookie("refreshToken", {
        domain: this.config.COOKIE_DOMAIN,
        path: "/api/auth/refresh",
      });

      sendSuccess(res, {
        message: "Password changed successfully. Please log in again.",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/forgot-password
   * Public — initiates the password reset flow by sending an OTP email.
   */
  forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as ForgotPasswordDto;
      await this.authService.forgotPassword(dto.email);
      // Always return success to prevent email enumeration
      sendSuccess(res, {
        message:
          "If an account with that email exists, a password reset OTP has been sent.",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/reset-password
   * Public — resets the password using an OTP received via email.
   */
  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as ResetPasswordDto;
      await this.authService.resetPassword(dto);
      sendSuccess(res, {
        message:
          "Password has been reset. Please log in with your new password.",
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/tutor-application
   */
  applyForTutor = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.authService.applyForTutor(
        req.user!.userId,
        req.user!.role,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };
}
