/**
 * Payment Gateway Interface.
 * Defines the minimal contract for all payment operations.
 * Adapters (MarzPaymentGateway, future: FlutterwaveGateway, …) implement this.
 */

/** Parameters to initiate a money collection. */
export interface CollectParams {
  /** Amount in the payment currency's major units (e.g. UGX, not cents). */
  readonly amount: number;
  /** MSISDN / mobile phone number of the payer. */
  readonly phoneNumber: string;
  /** Idempotent reference string — must be unique per payment attempt. */
  readonly reference: string;
  /** Optional human-readable description shown to the payer. */
  readonly description?: string;
  /** Optional webhook URL for async provider callbacks. */
  readonly callbackUrl?: string;
}

/** Normalised response returned by every gateway operation. */
export interface GatewayResponse {
  /** True only when the provider accepted the request AND the payment is confirmed. */
  readonly success: boolean;
  /**
   * Normalised status string:
   *   - "pending"  — still awaiting user action / provider processing
   *   - "success"  — payment confirmed
   *   - "failed"   — payment definitively failed
   */
  readonly status: "pending" | "success" | "failed";
  /** Provider-side UUID or reference used for subsequent status polling. */
  readonly providerUuid: string;
  /** Human-readable message from the provider (useful for logging). */
  readonly message: string;
  /** Raw response body for debugging — never exposed to clients. */
  readonly rawData: unknown;
}

/**
 * Pluggable payment gateway interface.
 * All payment adapters must implement this.
 */
export interface IPaymentGateway {
  /**
   * Initiates a mobile-money collection / card charge.
   * Returns immediately once the provider has accepted the request.
   * The payment may still be "pending" at this point.
   */
  collectMoney(params: CollectParams): Promise<GatewayResponse>;

  /**
   * Polls the provider for the current status of a payment.
   * Called by the BullMQ worker until a definitive status is reached.
   */
  checkStatus(providerUuid: string): Promise<GatewayResponse>;

  /**
   * Returns the current wallet / float balance of the platform account.
   * Used by the admin dashboard.
   */
  getBalance(): Promise<number>;
}
