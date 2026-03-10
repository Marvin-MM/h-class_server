import type { PrismaClient, CalendarEvent } from '@prisma/client';

export class CalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(events: { userId: string; sessionId: string; title: string; startsAt: Date; endsAt: Date }[]): Promise<void> {
    await this.prisma.calendarEvent.createMany({ data: events });
  }

  async findByUserIdAndDateRange(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        startsAt: { gte: startDate },
        endsAt: { lte: endDate },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findByUserId(userId: string): Promise<CalendarEvent[]> {
    return this.prisma.calendarEvent.findMany({
      where: { userId },
      orderBy: { startsAt: 'asc' },
    });
  }

  async updateBySessionId(sessionId: string, data: { startsAt?: Date; endsAt?: Date; title?: string }): Promise<void> {
    await this.prisma.calendarEvent.updateMany({ where: { sessionId }, data });
  }
}
