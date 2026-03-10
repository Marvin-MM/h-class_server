import type { Request, Response, NextFunction } from 'express';
import type { NotificationsService } from './service.js';
import type { RegisterPushTokenDto } from './dto.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/response.js';

export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const pageSize = parseInt(req.query['pageSize'] as string) || 20;
      const result = await this.notificationsService.getUserNotifications(req.user!.userId, page, pageSize);
      sendPaginated(res, result.data, result.meta);
    } catch (error) { next(error); }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.notificationsService.markAsRead(String(req.params['id']), req.user!.userId);
      sendSuccess(res, result);
    } catch (error) { next(error); }
  };

  registerPushToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.notificationsService.registerPushToken(req.user!.userId, req.body as RegisterPushTokenDto);
      sendSuccess(res, { message: 'Push token registered' }, 201);
    } catch (error) { next(error); }
  };
}
