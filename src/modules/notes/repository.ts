import type { PrismaClient, Note } from "@prisma/client";

/**
 * Notes repository. Enrollment access check is enforced in queries.
 */
export class NotesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    courseId: string;
    sessionId?: string;
    tutorId: string;
    title: string;
    s3Key: string;
  }): Promise<Note> {
    return this.prisma.note.create({ data });
  }

  /** Finds notes for a course — only accessible if the user is enrolled or is the tutor. */
  async findByCourseId(courseId: string, userId: string): Promise<Note[]> {
    // Check if user is enrolled or is the course tutor
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { tutorId: true },
    });

    if (course?.tutorId !== userId) {
      // Must be enrolled
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!enrollment) return [];
    }

    return this.prisma.note.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<Note | null> {
    return this.prisma.note.findUnique({ where: { id } });
  }
}
