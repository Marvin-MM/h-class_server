import type { PrismaClient } from '@prisma/client';
import type { IPaymentGateway } from './gateway.js';
import type { PaymentsRepository } from './repository.js';
import type { TransactionResponse, FinancialSummary } from './types.js';
import { eventBus, AppEvents } from '../../shared/utils/event-bus.js';
import { ConflictError, NotFoundError, AuthorizationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Service handling payment processing, webhook events, and transaction management.
 */
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Handles Stripe webhook events.
   * On payment_intent.succeeded: creates enrollment + transaction in a single Prisma transaction.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const event = this.paymentGateway.verifyWebhookSignature(rawBody, signature);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        await this.handlePaymentSuccess(event.data);
        break;
      }
      default:
        logger.info('Unhandled webhook event type', { type: event.type });
    }
  }

  /** Creates a Stripe Connect onboarding link for a tutor. */
  async createConnectOnboarding(
    userId: string,
    userRole: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    if (userRole !== 'TUTOR') {
      throw new AuthorizationError('Only tutors can create Connect accounts');
    }

    // Check if tutor already has a Connect account
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundError('User', userId);

    let accountId = user.stripeConnectId;
    if (!accountId) {
      const result = await this.paymentGateway.createConnectAccount(user.email);
      accountId = result.accountId;

      // Store the Connect account ID on the user record
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeConnectId: accountId },
      });
    }

    const link = await this.paymentGateway.createOnboardingLink(accountId, refreshUrl, returnUrl);

    logger.info('Connect onboarding link created', { userId, accountId });
    return { url: link.url };
  }

  /** Gets transaction history for a user. */
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

  /**
   * Handles a successful payment intent.
   * Creates the enrollment record and transaction ledger entry atomically.
   */
  private async handlePaymentSuccess(data: Record<string, unknown>): Promise<void> {
    const paymentIntentId = data['id'] as string;
    const metadata = data['metadata'] as Record<string, string>;
    const amountReceived = data['amount_received'] as number;
    const currency = (data['currency'] as string) ?? 'usd';

    const { courseId, userId, commissionRate, tutorId } = metadata;
    if (!courseId || !userId || !commissionRate) {
      logger.error('Webhook missing required metadata', { paymentIntentId, metadata });
      return;
    }

    // Idempotency check: skip if transaction already exists
    const existing = await this.paymentsRepository.findByPaymentIntentId(paymentIntentId);
    if (existing) {
      logger.info('Payment already processed, skipping', { paymentIntentId });
      return;
    }

    const rate = parseFloat(commissionRate);
    const grossAmount = amountReceived / 100;
    const platformFee = grossAmount * (rate / 100);
    const tutorNetAmount = grossAmount - platformFee;

    // Create enrollment + transaction atomically
    const result = await this.prisma.$transaction(async (tx) => {
      return this.paymentsRepository.createEnrollmentAndTransaction(
        tx,
        { userId, courseId },
        {
          userId,
          courseId,
          grossAmount,
          platformFee,
          tutorNetAmount,
          currency,
          stripePaymentIntentId: paymentIntentId,
          commissionRate: rate,
        },
      );
    });

    // Get course name for the event
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });

    // Emit enrollment created event
    eventBus.emit(AppEvents.ENROLLMENT_CREATED, {
      enrollmentId: result.enrollmentId,
      userId,
      courseId,
      courseName: course?.title ?? 'Unknown Course',
    });

    logger.info('Payment processed and enrollment created', {
      paymentIntentId,
      enrollmentId: result.enrollmentId,
      transactionId: result.transactionId,
    });
  }

  private toTransactionResponse(tx: {
    id: string;
    enrollmentId: string;
    userId: string;
    courseId: string;
    grossAmount: unknown;
    platformFee: unknown;
    tutorNetAmount: unknown;
    currency: string;
    stripePaymentIntentId: string;
    commissionRate: unknown;
    createdAt: Date;
  }): TransactionResponse {
    return {
      id: tx.id,
      enrollmentId: tx.enrollmentId,
      userId: tx.userId,
      courseId: tx.courseId,
      grossAmount: String(tx.grossAmount),
      platformFee: String(tx.platformFee),
      tutorNetAmount: String(tx.tutorNetAmount),
      currency: tx.currency,
      stripePaymentIntentId: tx.stripePaymentIntentId,
      commissionRate: String(tx.commissionRate),
      createdAt: tx.createdAt,
    };
  }
}
