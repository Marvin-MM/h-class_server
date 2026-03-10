import type { PrismaClient, Session, SessionStatus } from '@prisma/client';

export class SessionsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    courseId: string;
    title: string;
    scheduledAt: Date;
    duration: number;
    getStreamCallId: string | null;
  }): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async findByCourseId(courseId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { courseId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async updateStatus(id: string, status: SessionStatus): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { status },
    });
  }

  async updateGetStreamCallId(id: string, callId: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { getStreamCallId: callId },
    });
  }

  /** Finds sessions past scheduled time that are still SCHEDULED. */
  async findOverdueSessions(): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lt: new Date() },
      },
    });
  }
}
