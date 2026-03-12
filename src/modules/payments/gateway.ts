/**
 * Payment Gateway Interface.
 * Defines the contract for all payment operations.
 * No other code in the system imports from the Stripe library directly.
 */

/** Payment intent creation options. */
export interface CreatePaymentIntentOptions {
  readonly amount: number;
  readonly currency: string;
  readonly metadata: Record<string, string>;
  readonly idempotencyKey: string;
}

/** Payment intent result. */
export interface PaymentIntentResult {
  readonly id: string;
  readonly clientSecret: string;
  readonly status: string;
}

/** Refund options. */
export interface RefundOptions {
  readonly paymentIntentId: string;
  readonly amount?: number; // Partial refund if specified
  readonly reason?: string;
}

/** Refund result. */
export interface RefundResult {
  readonly id: string;
  readonly status: string;
  readonly amount: number;
}

/** Connect account creation result. */
export interface ConnectAccountResult {
  readonly accountId: string;
}

/** Onboarding link result. */
export interface OnboardingLinkResult {
  readonly url: string;
}

/** Transfer options. */
export interface TransferOptions {
  readonly amount: number;
  readonly currency: string;
  readonly destinationAccountId: string;
  readonly transferGroup?: string;
}

/** Transfer result. */
export interface TransferResult {
  readonly id: string;
  readonly amount: number;
}

/** Webhook event verification result. */
export interface WebhookEvent {
  readonly type: string;
  readonly data: Record<string, unknown>;
}

/**
 * Payment gateway interface — all payment operations go through this contract.
 * Implementations: StripePaymentGateway
 */
export interface IPaymentGateway {
  /** Creates a payment intent. */
  createPaymentIntent(
    options: CreatePaymentIntentOptions,
  ): Promise<PaymentIntentResult>;

  /** Confirms a payment (typically automatic). */
  confirmPayment(paymentIntentId: string): Promise<PaymentIntentResult>;

  /** Issues a full or partial refund. */
  issueRefund(options: RefundOptions): Promise<RefundResult>;

  /** Verifies webhook event signature and returns the parsed event. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): WebhookEvent;

  /** Creates a Stripe Connect Express account for a tutor. */
  createConnectAccount(email: string): Promise<ConnectAccountResult>;

  /** Generates a Stripe Connect onboarding link. */
  createOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<OnboardingLinkResult>;

  /** Transfers funds to a connected account. */
  transferFunds(options: TransferOptions): Promise<TransferResult>;
}
