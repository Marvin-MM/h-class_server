import type { Request, Response, NextFunction } from 'express';
import type { ChatService } from './service.js';
import type { CreateChannelDto } from './dto.js';
import { sendSuccess } from '../../shared/utils/response.js';

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  getToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, this.chatService.getToken(req.user!.userId));
    } catch (error) { next(error); }
  };

  createChannel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.chatService.createChannel(req.user!.userId, req.user!.role, req.body as CreateChannelDto);
      sendSuccess(res, result, 201);
    } catch (error) { next(error); }
  };
}
