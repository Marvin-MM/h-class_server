import type { Request, Response, NextFunction } from "express";
import type { ChatService } from "./service.js";
import type { CreateConversationDto, SendMessageDto } from "./dto.js";
import { sendSuccess, sendPaginated } from "../../shared/utils/response.js";
import type { Role } from "@prisma/client";

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  createConversation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.chatService.createConversation(
        req.user!.userId,
        req.user!.role as Role,
        req.body as CreateConversationDto,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  getUserConversations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.chatService.getUserConversations(req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.chatService.sendMessage(
        String(req.params["id"]),
        req.user!.userId,
        req.body as SendMessageDto,
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = parseInt(req.query["page"] as string) || 1;
      const pageSize = parseInt(req.query["pageSize"] as string) || 50;
      
      const result = await this.chatService.getMessages(
        String(req.params["id"]),
        req.user!.userId,
        page,
        pageSize,
      );
      sendPaginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  };
}
