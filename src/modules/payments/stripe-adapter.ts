import Stripe from 'stripe';
import type {
  IPaymentGateway,
  CreatePaymentIntentOptions,
  PaymentIntentResult,
  RefundOptions,
  RefundResult,
  ConnectAccountResult,
  OnboardingLinkResult,
  TransferOptions,
  TransferResult,
  WebhookEvent,
} from './gateway.js';
import type { AppConfig } from '../../config/index.js';
import { PaymentError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Stripe implementation of the payment gateway interface.
 * This is the only file that imports from the Stripe library.
 */
export class StripePaymentGateway implements IPaymentGateway {
  constructor(
    private readonly stripe: Stripe,
    private readonly config: AppConfig,
  ) {}

  async createPaymentIntent(options: CreatePaymentIntentOptions): Promise<PaymentIntentResult> {
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: options.amount,
          currency: options.currency,
          metadata: options.metadata,
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: options.idempotencyKey },
      );

      return {
        id: intent.id,
        clientSecret: intent.client_secret ?? '',
        status: intent.status,
      };
    } catch (error) {
      logger.error('Stripe createPaymentIntent failed', { error });
      throw new PaymentError('Failed to create payment intent');
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentIntentResult> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return {
        id: intent.id,
        clientSecret: intent.client_secret ?? '',
        status: intent.status,
      };
    } catch (error) {
      logger.error('Stripe confirmPayment failed', { error });
      throw new PaymentError('Failed to confirm payment');
    }
  }

  async issueRefund(options: RefundOptions): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: options.paymentIntentId,
        ...(options.amount ? { amount: options.amount } : {}),
        ...(options.reason ? { reason: options.reason as Stripe.RefundCreateParams.Reason } : {}),
      });

      return {
        id: refund.id,
        status: refund.status ?? 'unknown',
        amount: refund.amount,
      };
    } catch (error) {
      logger.error('Stripe issueRefund failed', { error });
      throw new PaymentError('Failed to issue refund');
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): WebhookEvent {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.STRIPE_WEBHOOK_SECRET,
      );

      return {
        type: event.type,
        data: event.data.object as unknown as Record<string, unknown>,
      };
    } catch (error) {
      logger.error('Stripe webhook signature verification failed', { error });
      throw new PaymentError('Invalid webhook signature', 400);
    }
  }

  async createConnectAccount(email: string): Promise<ConnectAccountResult> {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      return { accountId: account.id };
    } catch (error) {
      logger.error('Stripe createConnectAccount failed', { error });
      throw new PaymentError('Failed to create connected account');
    }
  }

  async createOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<OnboardingLinkResult> {
    try {
      const link = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return { url: link.url };
    } catch (error) {
      logger.error('Stripe createOnboardingLink failed', { error });
      throw new PaymentError('Failed to create onboarding link');
    }
  }

  async transferFunds(options: TransferOptions): Promise<TransferResult> {
    try {
      const transfer = await this.stripe.transfers.create({
        amount: options.amount,
        currency: options.currency,
        destination: options.destinationAccountId,
        ...(options.transferGroup ? { transfer_group: options.transferGroup } : {}),
      });

      return {
        id: transfer.id,
        amount: transfer.amount,
      };
    } catch (error) {
      logger.error('Stripe transferFunds failed', { error });
      throw new PaymentError('Failed to transfer funds');
    }
  }
}
