import { z } from "zod";

/** Schema for initiating a payment (enrollment). */
export const initiatePaymentSchema = z.object({
  courseId: z.string().uuid(),
  phoneNumber: z.string().min(9).max(15).regex(/^\+?[0-9]+$/, "Invalid phone number"),
  paymentType: z.enum(["FULL", "PARTIAL"]).default("FULL"),
});

/** Schema for initiating a balance payment. */
export const initiateBalancePaymentSchema = z.object({
  courseId: z.string().uuid(),
  phoneNumber: z.string().min(9).max(15).regex(/^\+?[0-9]+$/, "Invalid phone number"),
});

/** Schema for paginated transaction listing. */
export const listTransactionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Schema for financial summary query. */
export const financialSummarySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;
export type InitiateBalancePaymentDto = z.infer<typeof initiateBalancePaymentSchema>;
export type ListTransactionsDto = z.infer<typeof listTransactionsSchema>;
export type FinancialSummaryDto = z.infer<typeof financialSummarySchema>;
