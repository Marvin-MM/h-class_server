import type { PrismaClient, Transaction, Prisma } from "@prisma/client";

/**
 * Repository for payment/transaction database operations.
 * Transactions are append-only: no update or delete exposed to higher layers.
 */
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Creates the initial "initiated" transaction record before calling the provider. */
  async createTransaction(data: {
    userId: string;
    courseId: string;
    phoneNumber: string;
    amount: number;
    grossAmount: number;
    platformFee: number;
    tutorNetAmount: number;
    currency: string;
    providerTransactionId: string;
    commissionRate: number;
    paymentType?: "PARTIAL" | "FULL";
  }): Promise<Transaction> {
    return this.prisma.transaction.create({
      data: {
        ...data,
        status: "INITIATED",
        paymentType: data.paymentType ?? "FULL",
      },
    });
  }

  /** Atomically creates an enrollment and links it to an existing transaction. */
  async createEnrollmentAndLinkTransaction(
    tx: Prisma.TransactionClient,
    data: {
      transactionId: string;
      userId: string;
      courseId: string;
      paymentStatus: "PARTIAL" | "FULL";
    },
  ): Promise<{ enrollmentId: string }> {
    const enrollment = await tx.enrollment.create({
      data: {
        userId: data.userId,
        courseId: data.courseId,
        paymentStatus: data.paymentStatus,
      },
    });

    await tx.transaction.update({
      where: { id: data.transactionId },
      data: { enrollmentId: enrollment.id, status: "SUCCESS" },
    });

    return { enrollmentId: enrollment.id };
  }

  /** Upgrades an existing PARTIAL enrollment to FULL and marks the transaction SUCCESS. */
  async upgradeEnrollmentToFull(
    tx: Prisma.TransactionClient,
    data: {
      transactionId: string;
      userId: string;
      courseId: string;
    },
  ): Promise<{ enrollmentId: string }> {
    const enrollment = await tx.enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId: data.userId, courseId: data.courseId } },
    });

    await tx.enrollment.update({
      where: { id: enrollment.id },
      data: { paymentStatus: "FULL" },
    });

    await tx.transaction.update({
      where: { id: data.transactionId },
      data: { enrollmentId: enrollment.id, status: "SUCCESS" },
    });

    return { enrollmentId: enrollment.id };
  }

  /** Updates the provider-side UUID once the provider confirms the job was queued. */
  async updateProviderState(
    id: string,
    data: { status: "INITIATED" | "PROCESSING" | "SUCCESS" | "FAILED"; providerTransactionId?: string },
  ): Promise<void> {
    await this.prisma.transaction.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.providerTransactionId
          ? { providerTransactionId: data.providerTransactionId }
          : {}),
      },
    });
  }

  /** Finds a raw transaction by its internal ID. Used by the payment polling worker. */
  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  /** Idempotency: find a transaction by the provider UUID to skip double-processing. */
  async findByProviderTransactionId(providerTransactionId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { providerTransactionId } });
  }

  /** Lists transactions for a specific user with pagination. */
  async findByUserId(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: Transaction[]; total: number }> {
    const where = { userId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { data, total };
  }

  /** Gets financial summary with optional date range (admin). */
  async getFinancialSummary(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ totalGrossRevenue: number; totalPlatformFees: number; totalTutorPayouts: number }> {
    const where: Prisma.TransactionWhereInput = { status: "SUCCESS" };
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const result = await this.prisma.transaction.aggregate({
      where,
      _sum: { grossAmount: true, platformFee: true, tutorNetAmount: true },
    });

    return {
      totalGrossRevenue: Number(result._sum.grossAmount ?? 0),
      totalPlatformFees: Number(result._sum.platformFee ?? 0),
      totalTutorPayouts: Number(result._sum.tutorNetAmount ?? 0),
    };
  }
}
