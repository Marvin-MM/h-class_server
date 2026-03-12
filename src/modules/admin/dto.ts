import { z } from "zod";

export const applicationActionSchema = z.object({
  reason: z.string().max(1000).optional(), // Required for denial
});

export const createConfigSchema = z.object({
  key: z.string().min(1, "Config key is required").max(200),
  value: z.string().min(1, "Config value is required"),
});

export const updateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export const deleteConfigSchema = z.object({
  key: z.string().min(1, "Config key is required"),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  action: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const financialSummaryQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ApplicationActionDto = z.infer<typeof applicationActionSchema>;
export type CreateConfigDto = z.infer<typeof createConfigSchema>;
export type UpdateConfigDto = z.infer<typeof updateConfigSchema>;
export type DeleteConfigDto = z.infer<typeof deleteConfigSchema>;
export type AuditLogQueryDto = z.infer<typeof auditLogQuerySchema>;
export type FinancialSummaryQueryDto = z.infer<
  typeof financialSummaryQuerySchema
>;
