import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { Redis } from "ioredis";
import type { Queue } from "bullmq";
import type { AppConfig } from "../../config/index.js";
import { AuthRepository } from "./repository.js";
import type {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ResetPasswordDto,
} from "./dto.js";
import type {
  AuthUserResponse,
  LoginResult,
  SessionData,
  TokenPair,
} from "./types.js";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "../../shared/errors/index.js";
import { eventBus, AppEvents } from "../../shared/utils/event-bus.js";
import { logger } from "../../shared/utils/logger.js";

const BCRYPT_COST_FACTOR = 12;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const OTP_COOLDOWN_SECONDS = 60; // 1 minute between OTP requests

/**
 * Service handling all authentication business logic.
 * Manages user registration, login with single-device sessions,
 * token refresh, logout, email verification, password management, and tutor applications.
 */
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly redisClient: Redis,
    private readonly config: AppConfig,
    private readonly emailQueue: Queue,
  ) {}

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Registers a new user.
   * Hashes the password, creates the user record, generates an email verification OTP,
   * and enqueues the verification email.
   */
  async register(dto: RegisterDto): Promise<AuthUserResponse> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    const user = await this.authRepository.createUser({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    // Generate and send email verification OTP
    await this.generateAndSendOtp(
      user.id,
      user.email,
      user.firstName,
      "email_verification",
    );

    eventBus.emit(AppEvents.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });

    logger.info("User registered", { userId: user.id });

    return this.toUserResponse(user);
  }

  // ─── Email Verification ────────────────────────────────────────────────────

  /**
   * Verifies a user's email using a 6-digit OTP.
   * The OTP must match and not be expired (10-minute window).
   */
  async verifyEmail(userId: string, otp: string): Promise<void> {
    const storedOtp = await this.redisClient.get(
      `otp:email_verification:${userId}`,
    );
    if (!storedOtp) {
      throw new ValidationError("OTP has expired. Please request a new one.");
    }

    if (storedOtp !== otp) {
      throw new ValidationError("Invalid OTP. Please check and try again.");
    }

    await this.authRepository.markEmailVerified(userId);
    await this.redisClient.del(`otp:email_verification:${userId}`);

    logger.info("Email verified", { userId });
  }

  /**
   * Resends the email verification OTP.
   */
  async resendVerificationOtp(userId: string): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError("User", userId);
    if (user.emailVerified)
      throw new ConflictError("Email is already verified");

    await this.generateAndSendOtp(
      user.id,
      user.email,
      user.firstName,
      "email_verification",
    );

    logger.info("Verification OTP resent", { userId });
  }

  // ─── Login ─────────────────────────────────────────────────────────────────

  /**
   * Authenticates a user and creates a new single-device session.
   * If the user already has an active session, it is invalidated.
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new AuthenticationError("Invalid email or password");
    }

    // Single-device enforcement: invalidate any existing session
    const existingSessionId = await this.redisClient.get(
      `session:user:${user.id}`,
    );
    if (existingSessionId) {
      await this.redisClient.del(`session:${existingSessionId}`);
      logger.info("Previous session invalidated", {
        userId: user.id,
        oldSessionId: existingSessionId,
      });
    }

    // Create new session
    const sessionId = nanoid(32);
    const sessionData: SessionData = {
      userId: user.id,
      role: user.role,
      email: user.email,
      createdAt: new Date().toISOString(),
    };

    const pipeline = this.redisClient.pipeline();
    pipeline.setex(
      `session:${sessionId}`,
      SESSION_TTL_SECONDS,
      JSON.stringify(sessionData),
    );
    pipeline.setex(`session:user:${user.id}`, SESSION_TTL_SECONDS, sessionId);
    await pipeline.exec();

    const accessToken = this.generateAccessToken(user.id, sessionId, user.role);
    const refreshToken = nanoid(64);

    await this.redisClient.setex(
      `refresh:${refreshToken}`,
      REFRESH_TOKEN_TTL_SECONDS,
      JSON.stringify({ userId: user.id, sessionId }),
    );

    logger.info("User logged in", { userId: user.id, sessionId });

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user),
      sessionId,
    };
  }

  // ─── Token Refresh ─────────────────────────────────────────────────────────

  /**
   * Refreshes the access token and rotates the refresh token.
   */
  async refreshTokens(oldRefreshToken: string): Promise<TokenPair> {
    const tokenData = await this.redisClient.get(`refresh:${oldRefreshToken}`);
    if (!tokenData) {
      throw new AuthenticationError("Invalid or expired refresh token");
    }

    const { userId, sessionId } = JSON.parse(tokenData) as {
      userId: string;
      sessionId: string;
    };

    const sessionExists = await this.redisClient.exists(`session:${sessionId}`);
    if (!sessionExists) {
      await this.redisClient.del(`refresh:${oldRefreshToken}`);
      throw new AuthenticationError("Session has been invalidated");
    }

    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    await this.redisClient.del(`refresh:${oldRefreshToken}`);

    const newAccessToken = this.generateAccessToken(
      userId,
      sessionId,
      user.role,
    );
    const newRefreshToken = nanoid(64);

    await this.redisClient.setex(
      `refresh:${newRefreshToken}`,
      REFRESH_TOKEN_TTL_SECONDS,
      JSON.stringify({ userId, sessionId }),
    );

    logger.info("Tokens refreshed", { userId, sessionId });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ─── Logout ────────────────────────────────────────────────────────────────

  /**
   * Logs out the user by deleting session and refresh data from Redis.
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    pipeline.del(`session:${sessionId}`);
    pipeline.del(`session:user:${userId}`);
    await pipeline.exec();

    logger.info("User logged out", { userId, sessionId });
  }

  // ─── Password Management ──────────────────────────────────────────────────

  /**
   * Changes the password for an authenticated user.
   * Requires the current password for verification.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundError("User", userId);

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new AuthenticationError("Current password is incorrect");
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new ValidationError(
        "New password must be different from current password",
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_COST_FACTOR,
    );
    await this.authRepository.updatePassword(userId, hashedPassword);

    // Invalidate all sessions to force re-login with new password
    const existingSessionId = await this.redisClient.get(
      `session:user:${userId}`,
    );
    if (existingSessionId) {
      await this.redisClient.del(`session:${existingSessionId}`);
      await this.redisClient.del(`session:user:${userId}`);
    }

    logger.info("Password changed", { userId });
  }

  /**
   * Initiates the forgot password flow by generating an OTP and emailing it.
   * Always returns success to prevent email enumeration attacks.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.authRepository.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      logger.warn("Forgot password requested for non-existent email", {
        email,
      });
      return;
    }

    await this.generateAndSendOtp(
      user.id,
      user.email,
      user.firstName,
      "password_reset",
    );

    logger.info("Password reset OTP sent", { userId: user.id });
  }

  /**
   * Resets a user's password using an OTP received via email.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new ValidationError("Invalid email or OTP");
    }

    const storedOtp = await this.redisClient.get(
      `otp:password_reset:${user.id}`,
    );
    if (!storedOtp || storedOtp !== dto.otp) {
      throw new ValidationError("Invalid or expired OTP");
    }

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_COST_FACTOR,
    );
    await this.authRepository.updatePassword(user.id, hashedPassword);

    // Clean up OTP
    await this.redisClient.del(`otp:password_reset:${user.id}`);

    // Invalidate all sessions
    const existingSessionId = await this.redisClient.get(
      `session:user:${user.id}`,
    );
    if (existingSessionId) {
      await this.redisClient.del(`session:${existingSessionId}`);
      await this.redisClient.del(`session:user:${user.id}`);
    }

    logger.info("Password reset completed", { userId: user.id });
  }

  // ─── Tutor Application ────────────────────────────────────────────────────

  /**
   * Submits a tutor application for the authenticated user.
   */
  async applyForTutor(
    userId: string,
    userRole: string,
  ): Promise<{ applicationId: string }> {
    if (userRole !== "STUDENT") {
      throw new AuthorizationError("Only students can apply to become tutors");
    }

    const existing = await this.authRepository.findPendingApplication(userId);
    if (existing) {
      throw new ConflictError("You already have a pending tutor application");
    }

    const application =
      await this.authRepository.createTutorApplication(userId);

    logger.info("Tutor application submitted", {
      userId,
      applicationId: application.id,
    });

    return { applicationId: application.id };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Generates a 6-digit OTP, stores it in Redis with TTL, and enqueues an email.
   * Enforces a 60-second cooldown between OTP requests.
   */
  private async generateAndSendOtp(
    userId: string,
    email: string,
    firstName: string,
    type: "email_verification" | "password_reset",
  ): Promise<void> {
    // Enforce cooldown
    const cooldownKey = `otp_cooldown:${type}:${userId}`;
    const hasCooldown = await this.redisClient.exists(cooldownKey);
    if (hasCooldown) {
      throw new ConflictError("Please wait before requesting another OTP");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with TTL
    const otpKey = `otp:${type}:${userId}`;
    await this.redisClient.setex(otpKey, OTP_TTL_SECONDS, otp);

    // Set cooldown
    await this.redisClient.setex(cooldownKey, OTP_COOLDOWN_SECONDS, "1");

    // Enqueue email
    const subject =
      type === "email_verification"
        ? "Verify Your Email — H-Class LMS"
        : "Password Reset — H-Class LMS";

    const template =
      type === "email_verification" ? "verify-email" : "password-reset";

    await this.emailQueue.add(`${type}-otp`, {
      to: email,
      subject,
      template,
      data: { firstName, otp, expiresInMinutes: OTP_TTL_SECONDS / 60 },
    });

    logger.info(`OTP generated for ${type}`, { userId });
  }

  /**
   * Generates a signed JWT access token.
   */
  private generateAccessToken(
    userId: string,
    sessionId: string,
    role: string,
  ): string {
    return jwt.sign({ userId, sessionId, role }, this.config.JWT_SECRET, {
      expiresIn: this.config.JWT_ACCESS_EXPIRY,
    } as jwt.SignOptions);
  }

  /**
   * Strips sensitive fields from a user record for API responses.
   */
  private toUserResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    emailVerified: boolean;
    avatarUrl: string | null;
    createdAt: Date;
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
