import type { PrismaClient, User, Role } from "@prisma/client";

/**
 * Repository for user profile database operations.
 */
export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Finds a non-deleted user by ID. */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  /** Updates a user's profile fields. Role changes are not allowed through this method. */
  async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string | null },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /** Returns paginated non-deleted users, optionally filtered by role. */
  async findAll(
    page: number,
    pageSize: number,
    role?: Role,
  ): Promise<{ data: User[]; total: number }> {
    const where = { deletedAt: null, ...(role ? { role } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total };
  }

  /** Soft-deletes a user by setting the deletedAt timestamp. */
  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
