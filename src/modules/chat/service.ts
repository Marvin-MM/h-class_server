import type { ChatRepository } from "./repository.js";
import type { CoursesRepository } from "../courses/repository.js";
import type { CreateConversationDto, SendMessageDto } from "./dto.js";
import type { ConversationResponse, MessageResponse } from "./types.js";
import { AuthorizationError, ConflictError, NotFoundError } from "../../shared/errors/index.js";
import { logger } from "../../shared/utils/logger.js";
import type { Role, ChannelType } from "@prisma/client";

export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async createConversation(
    userId: string,
    role: Role,
    dto: CreateConversationDto,
  ): Promise<ConversationResponse> {
    const participants = new Set<string>();
    participants.add(userId);

    if (dto.type === "DIRECT") {
      if (!dto.targetUserId) {
        throw new ConflictError("targetUserId is required for DIRECT channels");
      }
      if (dto.targetUserId === userId) {
        throw new ConflictError("Cannot create a direct channel with yourself");
      }
      participants.add(dto.targetUserId);
    } else if (dto.type === "COURSE") {
      if (!dto.courseId) {
        throw new ConflictError("courseId is required for COURSE channels");
      }
      const course = await this.coursesRepository.findById(dto.courseId);
      if (!course) {
        throw new NotFoundError("Course", dto.courseId);
      }
      if (course.tutorId !== userId && role !== "ADMIN") {
        throw new AuthorizationError("Only the tutor can create a course channel");
      }
      participants.add(course.tutorId);
      const enrollments = await this.chatRepository.getCourseEnrollments(course.id);
      enrollments.forEach(e => participants.add(e.userId));
    } else if (dto.type === "SUPPORT") {
      const admins = await this.chatRepository.getAdmins();
      admins.forEach(a => participants.add(a.id));
    }

    const conversation = await this.chatRepository.createConversation({
      type: dto.type as ChannelType,
      courseId: dto.courseId,
      participantIds: Array.from(participants),
    });

    logger.info("Conversation created natively", {
      conversationId: conversation.id,
      type: dto.type,
    });

    return conversation as unknown as ConversationResponse;
  }

  async getUserConversations(userId: string) {
    const records = await this.chatRepository.getUserConversations(userId);
    return records;
  }

  async sendMessage(conversationId: string, userId: string, dto: SendMessageDto): Promise<MessageResponse> {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation", conversationId);
    }

    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new AuthorizationError("You are not a participant in this conversation");
    }

    const message = await this.chatRepository.createMessage(conversationId, userId, dto.content);

    logger.info("Message sent natively", { messageId: message.id, conversationId });
    return message;
  }

  async getMessages(conversationId: string, userId: string, page: number, pageSize: number) {
    const conversation = await this.chatRepository.findConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation", conversationId);
    }

    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new AuthorizationError("You are not a participant in this conversation");
    }

    const result = await this.chatRepository.getMessages(conversationId, page, pageSize);
    return {
      data: result.data,
      meta: { page, pageSize, total: result.total }
    };
  }
}
