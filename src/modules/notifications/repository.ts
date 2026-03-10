import type { PrismaClient, Notification, UserPushToken } from '@prisma/client';

export class NotificationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { userId: string; title: string; message: string }): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async findByUserId(userId: string, page: number, pageSize: number): Promise<{ data: Notification[]; total: number }> {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total };
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async registerPushToken(userId: string, token: string, platform: string): Promise<UserPushToken> {
    return this.prisma.userPushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async getUserPushTokens(userId: string): Promise<UserPushToken[]> {
    return this.prisma.userPushToken.findMany({ where: { userId } });
  }

  async deletePushToken(token: string): Promise<void> {
    await this.prisma.userPushToken.deleteMany({ where: { token } });
  }

  async deleteStaleTokens(olderThan: Date): Promise<number> {
    const result = await this.prisma.userPushToken.deleteMany({ where: { createdAt: { lt: olderThan } } });
    return result.count;
  }
}
