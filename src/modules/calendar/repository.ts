import type { PrismaClient } from "@prisma/client";

export class CalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserEventsAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.session.findMany({
      where: {
        scheduledAt: { gte: startDate, lte: endDate },
        OR: [
          { course: { tutorId: userId } },
          { course: { enrollments: { some: { userId } } } },
        ],
      },
      include: {
        course: { select: { title: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async findUserEvents(userId: string) {
    return this.prisma.session.findMany({
      where: {
        OR: [
          { course: { tutorId: userId } },
          { course: { enrollments: { some: { userId } } } },
        ],
      },
      include: {
        course: { select: { title: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });
  }
}

