import type { PrismaClient, Transaction, Prisma } from '@prisma/client';

/**
 * Repository for payment/transaction database operations.
 * The transactions table is append-only: no update or delete methods exposed.
 */
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Creates an immutable transaction record. */
  async createTransaction(data: {
    enrollmentId: string;
    userId: string;
    courseId: string;
    grossAmount: number;
    platformFee: number;
    tutorNetAmount: number;
    currency: string;
    stripePaymentIntentId: string;
    commissionRate: number;
  }): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  /** Creates an enrollment and transaction atomically within a Prisma transaction. */
  async createEnrollmentAndTransaction(
    tx: Prisma.TransactionClient,
    enrollment: { userId: string; courseId: string },
    transaction: {
      enrollmentId?: string;
      userId: string;
      courseId: string;
      grossAmount: number;
      platformFee: number;
      tutorNetAmount: number;
      currency: string;
      stripePaymentIntentId: string;
      commissionRate: number;
    },
  ): Promise<{ enrollmentId: string; transactionId: string }> {
    const enrollmentRecord = await tx.enrollment.create({
      data: { userId: enrollment.userId, courseId: enrollment.courseId },
    });

    const transactionRecord = await tx.transaction.create({
      data: {
        ...transaction,
        enrollmentId: enrollmentRecord.id,
      },
    });

    return { enrollmentId: enrollmentRecord.id, transactionId: transactionRecord.id };
  }

  /** Lists transactions for a specific user with pagination. */
  async findByUserId(userId: string, page: number, pageSize: number): Promise<{ data: Transaction[]; total: number }> {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { data, total };
  }

  /** Lists transactions for a course (tutor view). */
  async findByCourseId(courseId: string, page: number, pageSize: number): Promise<{ data: Transaction[]; total: number }> {
    const where = { courseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { data, total };
  }

  /** Gets financial summary with optional date range. */
  async getFinancialSummary(startDate?: Date, endDate?: Date): Promise<{
    totalGrossRevenue: number;
    totalPlatformFees: number;
    totalTutorPayouts: number;
  }> {
    const where: Prisma.TransactionWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const result = await this.prisma.transaction.aggregate({
      where,
      _sum: {
        grossAmount: true,
        platformFee: true,
        tutorNetAmount: true,
      },
    });

    return {
      totalGrossRevenue: Number(result._sum.grossAmount ?? 0),
      totalPlatformFees: Number(result._sum.platformFee ?? 0),
      totalTutorPayouts: Number(result._sum.tutorNetAmount ?? 0),
    };
  }

  /** Finds a transaction by Stripe payment intent ID. */
  async findByPaymentIntentId(paymentIntentId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
  }
}
