import type { StreamChat, ChannelData } from 'stream-chat';
import type { ChannelType } from '@prisma/client';
import type { ChatRepository } from './repository.js';
import type { CoursesRepository } from '../courses/repository.js';
import type { CreateChannelDto } from './dto.js';
import type { ChatTokenResponse, ChannelResponse } from './types.js';
import { AuthorizationError, ValidationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly coursesRepository: CoursesRepository,
    private readonly streamChatClient: StreamChat,
    private readonly getStreamApiKey: string,
  ) {}

  /** Generates a GetStream Chat token for the authenticated user. Never stored in DB. */
  getToken(userId: string): ChatTokenResponse {
    const token = this.streamChatClient.createToken(userId);
    return { token, userId };
  }

  /** Creates a chat channel based on type. */
  async createChannel(userId: string, userRole: string, dto: CreateChannelDto): Promise<ChannelResponse> {
    let channelId: string;
    let members: string[];

    switch (dto.type) {
      case 'STUDENT_TUTOR': {
        if (!dto.courseId) throw new ValidationError('courseId is required for STUDENT_TUTOR channels');
        const isEnrolled = await this.coursesRepository.isEnrolled(userId, dto.courseId);
        if (!isEnrolled) throw new AuthorizationError('You must be enrolled in the course');

        const course = await this.coursesRepository.findById(dto.courseId);
        if (!course) throw new ValidationError('Course not found');

        channelId = `st-${dto.courseId}-${userId}`;
        members = [userId, course.tutorId];
        break;
      }
      case 'COURSE_SUPPORT': {
        if (!dto.courseId) throw new ValidationError('courseId is required for COURSE_SUPPORT channels');
        channelId = `cs-${dto.courseId}`;
        members = [userId]; // Members are managed dynamically
        break;
      }
      case 'SUPPORT': {
        channelId = `support-${userId}`;
        members = [userId]; // Admin members added automatically
        break;
      }
      default:
        throw new ValidationError('Invalid channel type');
    }

    // Check if channel already exists in our DB
    let existing = await this.chatRepository.findByStreamChannelId(channelId);
    if (!existing) {
      // Create channel in GetStream with attachments disabled
      try {
        const channel = this.streamChatClient.channel('messaging', channelId, {
          members,
          created_by_id: userId,
        } as ChannelData);

        await channel.create();

        // Disable file/image uploads at channel level
        await channel.updatePartial({
          set: {
            config_overrides: {
              uploads: false,
            },
          } as Record<string, unknown>,
        });
      } catch (error) {
        logger.error('Failed to create GetStream Chat channel', { error, channelId });
      }

      existing = await this.chatRepository.create({
        type: dto.type as ChannelType,
        courseId: dto.courseId,
        getStreamChannelId: channelId,
      });
    }

    return this.toResponse(existing);
  }

  private toResponse(ch: { id: string; type: string; courseId: string | null; getStreamChannelId: string; createdAt: Date }): ChannelResponse {
    return { id: ch.id, type: ch.type, courseId: ch.courseId, getStreamChannelId: ch.getStreamChannelId, createdAt: ch.createdAt };
  }
}
