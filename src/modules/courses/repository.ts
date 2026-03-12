import type { PrismaClient, Course, Enrollment, Prisma } from "@prisma/client";

/** Pagination options. */
interface PaginationOptions {
  page: number;
  pageSize: number;
}

/** Paginated result. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

/**
 * Repository for course-related database operations.
 */
export class CoursesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Creates a new course. */
  async create(data: {
    tutorId: string;
    title: string;
    description: string;
    price: number;
    passMark: number;
    commissionRate: number;
  }): Promise<Course> {
    return this.prisma.course.create({
      data: {
        tutorId: data.tutorId,
        title: data.title,
        description: data.description,
        price: data.price,
        passMark: data.passMark,
        commissionRate: data.commissionRate,
      },
    });
  }

  /** Finds a non-deleted course by ID. */
  async findById(id: string): Promise<Course | null> {
    return this.prisma.course.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Finds a course with its tutor info. */
  async findByIdWithTutor(
    id: string,
  ): Promise<
    | (Course & { tutor: { id: string; firstName: string; lastName: string } })
    | null
  > {
    return this.prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        tutor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /** Lists courses with pagination and optional filters. */
  async findMany(options: {
    pagination: PaginationOptions;
    status?: string;
    tutorId?: string;
    search?: string;
  }): Promise<
    PaginatedResult<
      Course & { tutor: { id: string; firstName: string; lastName: string } }
    >
  > {
    const where: Prisma.CourseWhereInput = {
      deletedAt: null,
      ...(options.status ? { status: options.status as Course["status"] } : {}),
      ...(options.tutorId ? { tutorId: options.tutorId } : {}),
      ...(options.search
        ? {
            OR: [
              {
                title: {
                  contains: options.search,
                  mode: "insensitive" as const,
                },
              },
              {
                description: {
                  contains: options.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        include: {
          tutor: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (options.pagination.page - 1) * options.pagination.pageSize,
        take: options.pagination.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.course.count({ where }),
    ]);

    return { data, total };
  }

  /** Updates a course. */
  async update(
    id: string,
    data: Partial<
      Pick<Course, "title" | "description" | "price" | "passMark" | "status">
    >,
  ): Promise<Course> {
    return this.prisma.course.update({
      where: { id },
      data,
    });
  }

  /** Checks if a student is enrolled in a course. */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return enrollment !== null;
  }

  /** Gets an enrollment record. */
  async getEnrollment(
    userId: string,
    courseId: string,
  ): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  /** Creates an enrollment record. */
  async createEnrollment(data: {
    userId: string;
    courseId: string;
  }): Promise<Enrollment> {
    return this.prisma.enrollment.create({ data });
  }

  /** Counts enrolled students in a course. */
  async countEnrollments(courseId: string): Promise<number> {
    return this.prisma.enrollment.count({ where: { courseId } });
  }

  /** List enrolled students for a course. */
  async findEnrollments(
    courseId: string,
    pagination: PaginationOptions,
  ): Promise<
    PaginatedResult<
      Enrollment & {
        user: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
        };
      }
    >
  > {
    const where = { courseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { data, total };
  }

  /** List a student's enrollments. */
  async findStudentEnrollments(
    userId: string,
    pagination: PaginationOptions,
  ): Promise<
    PaginatedResult<Enrollment & { course: { title: string; status: string } }>
  > {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        include: { course: { select: { title: true, status: true } } },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { data, total };
  }

  /** Find a course and lock the row for update (used in enrollment). */
  async findByIdForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Course | null> {
    const results = await tx.$queryRaw<Course[]>`
      SELECT * FROM courses WHERE id = ${id} AND "deletedAt" IS NULL FOR UPDATE
    `;
    return results[0] ?? null;
  }

  /** Soft-deletes a course. */
  async softDelete(id: string): Promise<Course> {
    return this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
