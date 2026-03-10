/** Types specific to the Payments module. */

/** Transaction response shape for API. */
export interface TransactionResponse {
  readonly id: string;
  readonly enrollmentId: string;
  readonly userId: string;
  readonly courseId: string;
  readonly grossAmount: string;
  readonly platformFee: string;
  readonly tutorNetAmount: string;
  readonly currency: string;
  readonly stripePaymentIntentId: string;
  readonly commissionRate: string;
  readonly createdAt: Date;
}

/** Financial summary for admin dashboard. */
export interface FinancialSummary {
  readonly totalGrossRevenue: string;
  readonly totalPlatformFees: string;
  readonly totalTutorPayouts: string;
}
