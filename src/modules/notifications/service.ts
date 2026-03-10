import type { Queue } from 'bullmq';
import type { NotificationsRepository } from './repository.js';
import type { NotificationResponse } from './types.js';
import type { RegisterPushTokenDto } from './dto.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Service handling in-app notifications and push notification dispatching.
 */
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly pushNotificationQueue: Queue,
  ) {}

  /** Creates an in-app notification and enqueues a push notification. */
  async notify(userId: string, title: string, message: string): Promise<void> {
    // Create in-app notification
    await this.notificationsRepository.create({ userId, title, message });

    // Enqueue push notification via BullMQ
    await this.pushNotificationQueue.add('send-push', { userId, title, message });

    logger.info('Notification sent', { userId, title });
  }

  /** Gets paginated notifications for a user. */
  async getUserNotifications(userId: string, page: number, pageSize: number) {
    const result = await this.notificationsRepository.findByUserId(userId, page, pageSize);
    return {
      data: result.data.map(this.toResponse),
      meta: { page, pageSize, total: result.total },
    };
  }

  /** Marks a notification as read. */
  async markAsRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.notificationsRepository.markAsRead(notificationId, userId);
    return this.toResponse(notification);
  }

  /** Registers an FCM push token for the user. */
  async registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<void> {
    await this.notificationsRepository.registerPushToken(userId, dto.token, dto.platform);
    logger.info('Push token registered', { userId, platform: dto.platform });
  }

  private toResponse(n: { id: string; userId: string; title: string; message: string; read: boolean; createdAt: Date }): NotificationResponse {
    return { id: n.id, userId: n.userId, title: n.title, message: n.message, read: n.read, createdAt: n.createdAt };
  }
}
