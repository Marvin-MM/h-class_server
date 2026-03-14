import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { IPaymentGateway } from "./gateway.js";
import type { PaymentsRepository } from "./repository.js";
import type { TransactionResponse, FinancialSummary, InitiatePaymentResult } from "./types.js";
import type { Queue } from "bullmq";
import { eventBus, AppEvents } from "../../shared/utils/event-bus.js";
import {
  ConflictError,
  NotFoundError,
  AuthorizationError,
} from "../../shared/errors/index.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Service handling payment processing and transaction management.
 *
 * Flow:
 *   1. initiatePayment() — record transaction as INITIATED, call provider collectMoney(),
 *      update to PROCESSING, enqueue a BullMQ polling job.
 *   2. BullMQ worker polls checkStatus() until SUCCESS or FAILED.
 *   3. reconcilePaymentOutcome() — called by the worker upon definitive status:
 *      creates enrollment + links transaction atomically.
 */
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly prisma: PrismaClient,
    private readonly paymentVerificationQueue: Queue,
  ) {}

  /**
   * Initiates a course enrollment payment via Marz.
   * Returns immediately after enqueuing the provider request.
   */
  async initiatePayment(
    userId: string,
    courseId: string,
    phoneNumber: string,
    paymentType: "FULL" | "PARTIAL" = "FULL",
  ): Promise<InitiatePaymentResult> {
    return this.prisma.$transaction(async (tx) => {
      // Lock-read the course to prevent races
      const course = await tx.course.findFirst({
        where: { id: courseId, deletedAt: null },
      });
      if (!course) throw new NotFoundError("Course", courseId);
      if (course.status !== "PUBLISHED")
        throw new ConflictError("Course is not available for enrollment");

      const isEnrolled = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (isEnrolled) throw new ConflictError("You are already enrolled in this course");

      // Calculate amounts
      const commissionRate = Number(course.commissionRate);
      let amount = Number(course.price);
      if (paymentType === "PARTIAL") amount = amount * 0.6;

      const platformFee = amount * (commissionRate / 100);
      const tutorNetAmount = amount - platformFee;

      const reference = randomUUID();

      // 1. Create transaction record in INITIATED state
      const txRecord = await this.paymentsRepository.createTransaction({
        userId,
        courseId,
        phoneNumber,
        amount,
        grossAmount: amount,
        platformFee,
        tutorNetAmount,
        currency: "UGX",
        providerTransactionId: reference, // Temporary — will be updated with Marz UUID
        commissionRate,
        paymentType,
      });

      // 2. Call Marz
      const result = await this.paymentGateway.collectMoney({
        amount,
        phoneNumber,
        reference,
        description: `Enrollment payment for course ${course.title} (${paymentType})`,
      });

      if (!result.success && result.status === "failed") {
        await this.paymentsRepository.updateProviderState(txRecord.id, { status: "FAILED" });
        throw new ConflictError(result.message);
      }

      // 3. Update transaction to PROCESSING with provider UUID
      await this.paymentsRepository.updateProviderState(txRecord.id, {
        status: "PROCESSING",
        providerTransactionId: result.providerUuid,
      });

      // 4. Dispatch BullMQ polling job (10 s delay — give user time to approve the prompt)
      await this.paymentVerificationQueue.add(
        "verify-payment",
        {
          transactionId: txRecord.id,
          providerUuid: result.providerUuid,
          userId,
          courseId,
          paymentType,
        },
        {
          delay: 10_000,
          attempts: 10,
          backoff: { type: "exponential", delay: 15_000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      logger.info("Payment initiated and queued for polling", {
        transactionId: txRecord.id,
        providerUuid: result.providerUuid,
        userId,
        courseId,
        paymentType,
      });

      return {
        reference,
        status: "processing",
        message: "Check your phone for the payment prompt.",
      };
    });
  }

  /**
   * Initiates payment for the remaining 40% balance of a PARTIAL enrollment.
   */
  async initiateBalancePayment(
    userId: string,
    courseId: string,
    phoneNumber: string,
  ): Promise<InitiatePaymentResult> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
    });
    if (!course) throw new NotFoundError("Course", courseId);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new ConflictError("You are not enrolled in this course");
    if (enrollment.paymentStatus === "FULL")
      throw new ConflictError("Your course balance is already fully paid");

    const commissionRate = Number(course.commissionRate);
    const amount = Number(course.price) * 0.4; // Remaining 40%
    const platformFee = amount * (commissionRate / 100);
    const tutorNetAmount = amount - platformFee;

    const reference = randomUUID();

    const txRecord = await this.paymentsRepository.createTransaction({
      userId,
      courseId,
      phoneNumber,
      amount,
      grossAmount: amount,
      platformFee,
      tutorNetAmount,
      currency: "UGX",
      providerTransactionId: reference,
      commissionRate,
      paymentType: "FULL", // Completing unpaid balance counts as FULL
    });

    const result = await this.paymentGateway.collectMoney({
      amount,
      phoneNumber,
      reference,
      description: `Balance payment for course ${course.title}`,
    });

    if (!result.success && result.status === "failed") {
      await this.paymentsRepository.updateProviderState(txRecord.id, { status: "FAILED" });
      throw new ConflictError(result.message);
    }

    await this.paymentsRepository.updateProviderState(txRecord.id, {
      status: "PROCESSING",
      providerTransactionId: result.providerUuid,
    });

    await this.paymentVerificationQueue.add(
      "verify-payment",
      {
        transactionId: txRecord.id,
        providerUuid: result.providerUuid,
        userId,
        courseId,
        paymentType: "BALANCE",
      },
      {
        delay: 10_000,
        attempts: 10,
        backoff: { type: "exponential", delay: 15_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      reference,
      status: "processing",
      message: "Check your phone for the payment prompt.",
    };
  }

  /**
   * Called by the BullMQ worker once the provider reports a definitive status.
   * Idempotent — safe to call multiple times for the same transaction.
   */
  async reconcilePaymentOutcome(
    transactionId: string,
    providerStatus: string,
  ): Promise<void> {
    const txRecord = await this.paymentsRepository.findById(transactionId);
    if (!txRecord || txRecord.status !== "PROCESSING") {
      logger.info("Transaction already reconciled or not found, skipping", { transactionId });
      return;
    }

    const isSuccess = ["success", "completed", "successful"].includes(
      providerStatus.toLowerCase(),
    );

    if (!isSuccess) {
      await this.paymentsRepository.updateProviderState(transactionId, { status: "FAILED" });
      logger.info("Payment failed, transaction marked FAILED", { transactionId });
      return;
    }

    // Determine the operation type from the stored paymentType
    const paymentType = txRecord.paymentType;

    let enrollmentId: string;

    await this.prisma.$transaction(async (tx) => {
      if (paymentType === "FULL" && !txRecord.enrollmentId) {
        // New enrollment
        const result = await this.paymentsRepository.createEnrollmentAndLinkTransaction(tx, {
          transactionId,
          userId: txRecord.userId,
          courseId: txRecord.courseId,
          paymentStatus: "FULL",
        });
        enrollmentId = result.enrollmentId;
      } else if (paymentType === "PARTIAL" && !txRecord.enrollmentId) {
        // New partial enrollment
        const result = await this.paymentsRepository.createEnrollmentAndLinkTransaction(tx, {
          transactionId,
          userId: txRecord.userId,
          courseId: txRecord.courseId,
          paymentStatus: "PARTIAL",
        });
        enrollmentId = result.enrollmentId;
      } else {
        // BALANCE payment — upgrade existing enrollment to FULL
        const result = await this.paymentsRepository.upgradeEnrollmentToFull(tx, {
          transactionId,
          userId: txRecord.userId,
          courseId: txRecord.courseId,
        });
        enrollmentId = result.enrollmentId;
      }
    });

    // Emit event so calendar, notifications, etc. react
    if (paymentType !== "FULL" || !txRecord.enrollmentId) {
      const course = await this.prisma.course.findUnique({
        where: { id: txRecord.courseId },
        select: { title: true },
      });
      eventBus.emit(AppEvents.ENROLLMENT_CREATED, {
        enrollmentId: enrollmentId!,
        userId: txRecord.userId,
        courseId: txRecord.courseId,
        courseName: course?.title ?? "Unknown Course",
      });
    }

    logger.info("Payment reconciled — enrollment created/upgraded", {
      transactionId,
      userId: txRecord.userId,
      courseId: txRecord.courseId,
    });
  }

  /** Gets transaction history for a user (paginated). */
  async getUserTransactions(userId: string, page: number, pageSize: number) {
    const result = await this.paymentsRepository.findByUserId(userId, page, pageSize);
    return {
      data: result.data.map(this.toTransactionResponse),
      meta: { page, pageSize, total: result.total },
    };
  }

  /** Gets financial summary (admin). */
  async getFinancialSummary(startDate?: Date, endDate?: Date): Promise<FinancialSummary> {
    const summary = await this.paymentsRepository.getFinancialSummary(startDate, endDate);
    return {
      totalGrossRevenue: summary.totalGrossRevenue.toFixed(2),
      totalPlatformFees: summary.totalPlatformFees.toFixed(2),
      totalTutorPayouts: summary.totalTutorPayouts.toFixed(2),
    };
  }

  private toTransactionResponse(tx: {
    id: string;
    enrollmentId: string | null;
    userId: string;
    courseId: string;
    amount: unknown;
    currency: string;
    providerTransactionId: string;
    status: string;
    createdAt: Date;
  }): TransactionResponse {
    return {
      id: tx.id,
      enrollmentId: tx.enrollmentId,
      userId: tx.userId,
      courseId: tx.courseId,
      amount: String(tx.amount),
      currency: tx.currency,
      providerTransactionId: tx.providerTransactionId,
      status: tx.status as TransactionResponse["status"],
      createdAt: tx.createdAt,
    };
  }
}
