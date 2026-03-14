/** Transaction status as stored in the database. */
export type PaymentStatus = "initiated" | "processing" | "success" | "failed";

/** Serialised transaction sent to API consumers. */
export interface TransactionResponse {
  readonly id: string;
  readonly enrollmentId: string | null;
  readonly userId: string;
  readonly courseId: string;
  readonly amount: string;
  readonly currency: string;
  readonly providerTransactionId: string;
  readonly status: PaymentStatus;
  readonly createdAt: Date;
}

/** Aggregated financial summary for the admin dashboard. */
export interface FinancialSummary {
  readonly totalGrossRevenue: string;
  readonly totalPlatformFees: string;
  readonly totalTutorPayouts: string;
}

/** Result returned when a payment collection is initiated. */
export interface InitiatePaymentResult {
  /** Idempotent reference the client should keep for status polling. */
  readonly reference: string;
  /** Current provider status — always "processing" immediately after initiation. */
  readonly status: string;
  /** User-facing message (e.g. "Check your phone for the payment prompt."). */
  readonly message: string;
}
