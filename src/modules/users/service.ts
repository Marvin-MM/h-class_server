import type Redis from 'ioredis';
import type { UsersRepository } from './repository.js';
import type { UpdateProfileDto } from './dto.js';
import type { UserProfileResponse } from './types.js';
import type { MediaService } from '../media/service.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Service handling user profile management.
 */
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly redisClient: Redis,
    private readonly mediaService: MediaService,
  ) {}

  /** Retrieves the authenticated user's profile. */
  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return this.toProfileResponse(user);
  }

  /** Updates the authenticated user's profile. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileResponse> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const updated = await this.usersRepository.updateProfile(userId, dto);
    logger.info('User profile updated', { userId });
    return this.toProfileResponse(updated);
  }

  /** Generates a pre-signed S3 URL for avatar upload. */
  async getAvatarUploadUrl(userId: string, contentType: string, fileName: string) {
    return this.mediaService.generateUploadUrl({
      prefix: `avatars/${userId}`,
      contentType,
      fileName,
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSizeMb: 5,
    });
  }

  /** Soft-deletes the user and invalidates their session. */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Soft delete
    await this.usersRepository.softDelete(userId);

    // Invalidate session in Redis
    const sessionId = await this.redisClient.get(`session:user:${userId}`);
    if (sessionId) {
      const pipeline = this.redisClient.pipeline();
      pipeline.del(`session:${sessionId}`);
      pipeline.del(`session:user:${userId}`);
      await pipeline.exec();
    }

    logger.info('User account soft-deleted and session invalidated', { userId });
  }

  private toProfileResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
