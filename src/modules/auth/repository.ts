import type { PrismaClient, User, TutorApplication, ApplicationStatus } from '@prisma/client';

/**
 * Repository for authentication-related database operations.
 * All database access is encapsulated here — no raw Prisma calls in services.
 */
export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a user by email, including soft-deleted users.
   * Used during login to validate credentials.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  /**
   * Finds a user by ID, excluding soft-deleted users.
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /**
   * Creates a new user with hashed password and default STUDENT role.
   */
  async createUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });
  }

  /**
   * Finds a pending tutor application for a given user.
   */
  async findPendingApplication(userId: string): Promise<TutorApplication | null> {
    return this.prisma.tutorApplication.findFirst({
      where: { userId, status: 'PENDING' as ApplicationStatus },
    });
  }

  /**
   * Creates a new tutor application.
   */
  async createTutorApplication(userId: string): Promise<TutorApplication> {
    return this.prisma.tutorApplication.create({
      data: { userId },
    });
  }
}
