import { z } from 'zod';

/** Schema for requesting Connect onboarding. */
export const connectOnboardingSchema = z.object({
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
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

export type ConnectOnboardingDto = z.infer<typeof connectOnboardingSchema>;
export type ListTransactionsDto = z.infer<typeof listTransactionsSchema>;
export type FinancialSummaryDto = z.infer<typeof financialSummarySchema>;
