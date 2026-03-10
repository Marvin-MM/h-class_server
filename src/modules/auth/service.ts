import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import type Redis from 'ioredis';
import type { Queue } from 'bullmq';
import type { AppConfig } from '../../config/index.js';
import { AuthRepository } from './repository.js';
import type { RegisterDto, LoginDto } from './dto.js';
import type { AuthUserResponse, LoginResult, SessionData, TokenPair } from './types.js';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from '../../shared/errors/index.js';
import { eventBus, AppEvents } from '../../shared/utils/event-bus.js';
import { logger } from '../../shared/utils/logger.js';

const BCRYPT_COST_FACTOR = 12;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Service handling all authentication business logic.
 * Manages user registration, login with single-device sessions,
 * token refresh, logout, and tutor applications.
 */
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly redisClient: Redis,
    private readonly config: AppConfig,
    private readonly emailQueue: Queue,
  ) {}

  /**
   * Registers a new user.
   * Hashes the password, creates the user record, and enqueues a welcome email.
   */
  async register(dto: RegisterDto): Promise<AuthUserResponse> {
    // Check if email is already taken
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    // Create user
    const user = await this.authRepository.createUser({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    // Enqueue welcome email asynchronously
    await this.emailQueue.add('welcome-email', {
      to: user.email,
      subject: 'Welcome to H-Class LMS',
      template: 'welcome',
      data: { firstName: user.firstName },
    });

    // Emit user registered event
    eventBus.emit(AppEvents.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });

    logger.info('User registered', { userId: user.id });

    return this.toUserResponse(user);
  }

  /**
   * Authenticates a user and creates a new single-device session.
   * If the user already has an active session, it is invalidated.
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    // Find user
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Validate password
    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Single-device enforcement: invalidate any existing session
    const existingSessionId = await this.redisClient.get(`session:user:${user.id}`);
    if (existingSessionId) {
      await this.redisClient.del(`session:${existingSessionId}`);
      logger.info('Previous session invalidated', { userId: user.id, oldSessionId: existingSessionId });
    }

    // Create new session
    const sessionId = nanoid(32);
    const sessionData: SessionData = {
      userId: user.id,
      role: user.role,
      email: user.email,
      createdAt: new Date().toISOString(),
    };

    // Pipe: set session data + reverse lookup atomically
    const pipeline = this.redisClient.pipeline();
    pipeline.setex(`session:${sessionId}`, SESSION_TTL_SECONDS, JSON.stringify(sessionData));
    pipeline.setex(`session:user:${user.id}`, SESSION_TTL_SECONDS, sessionId);
    await pipeline.exec();

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, sessionId, user.role);
    const refreshToken = nanoid(64);

    // Store refresh token in Redis
    await this.redisClient.setex(
      `refresh:${refreshToken}`,
      REFRESH_TOKEN_TTL_SECONDS,
      JSON.stringify({ userId: user.id, sessionId }),
    );

    logger.info('User logged in', { userId: user.id, sessionId });

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(user),
      sessionId,
    };
  }

  /**
   * Refreshes the access token and rotates the refresh token.
   * The old refresh token is invalidated on rotation.
   */
  async refreshTokens(oldRefreshToken: string): Promise<TokenPair> {
    // Validate the old refresh token
    const tokenData = await this.redisClient.get(`refresh:${oldRefreshToken}`);
    if (!tokenData) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const { userId, sessionId } = JSON.parse(tokenData) as { userId: string; sessionId: string };

    // Verify session still exists
    const sessionExists = await this.redisClient.exists(`session:${sessionId}`);
    if (!sessionExists) {
      // Clean up the refresh token
      await this.redisClient.del(`refresh:${oldRefreshToken}`);
      throw new AuthenticationError('Session has been invalidated');
    }

    // Get user for current role
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Invalidate old refresh token (rotation)
    await this.redisClient.del(`refresh:${oldRefreshToken}`);

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(userId, sessionId, user.role);
    const newRefreshToken = nanoid(64);

    // Store new refresh token
    await this.redisClient.setex(
      `refresh:${newRefreshToken}`,
      REFRESH_TOKEN_TTL_SECONDS,
      JSON.stringify({ userId, sessionId }),
    );

    logger.info('Tokens refreshed', { userId, sessionId });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logs out the user by deleting session and refresh data from Redis.
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    pipeline.del(`session:${sessionId}`);
    pipeline.del(`session:user:${userId}`);
    await pipeline.exec();

    // Clean up any refresh tokens for this session
    // Note: A scan approach. For simplicity, logout clears the session,
    // and any refresh token tied to it will be rejected on next use.

    logger.info('User logged out', { userId, sessionId });
  }

  /**
   * Submits a tutor application for the authenticated user.
   * Only STUDENT users can apply, and only one PENDING application is allowed.
   */
  async applyForTutor(userId: string, userRole: string): Promise<{ applicationId: string }> {
    if (userRole !== 'STUDENT') {
      throw new AuthorizationError('Only students can apply to become tutors');
    }

    // Check for existing pending application
    const existing = await this.authRepository.findPendingApplication(userId);
    if (existing) {
      throw new ConflictError('You already have a pending tutor application');
    }

    const application = await this.authRepository.createTutorApplication(userId);

    logger.info('Tutor application submitted', { userId, applicationId: application.id });

    return { applicationId: application.id };
  }

  /**
   * Generates a signed JWT access token.
   */
  private generateAccessToken(userId: string, sessionId: string, role: string): string {
    return jwt.sign(
      { userId, sessionId, role },
      this.config.JWT_SECRET,
      { expiresIn: this.config.JWT_ACCESS_EXPIRY } as jwt.SignOptions,
    );
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
    avatarUrl: string | null;
    createdAt: Date;
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }
}
