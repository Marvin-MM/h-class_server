import { z } from "zod";

/** Schema for creating a course. */
export const createCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  price: z.number().positive("Price must be positive").multipleOf(0.01),
  passMark: z.number().min(50, "Pass mark must be at least 50").max(100, "Pass mark must be between 50 and 100"),
});

/** Schema for updating a course. */
export const updateCourseSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).max(5000).optional(),
    price: z.number().positive().multipleOf(0.01).optional(),
    passMark: z.number().min(50).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

/** Schema for paginated course listing. */
export const listCoursesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["DRAFT", "PUBLISHED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"])
    .optional(),
  tutorId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

/** Schema for route parameters with course ID. */
export const courseIdParamSchema = z.object({
  id: z.string().uuid("Invalid course ID"),
});

/** Schema for initiating enrollment (Marz Pay). */
export const initiateEnrollmentSchema = z.object({
  phoneNumber: z.string().min(9).max(15).regex(/^\+?[0-9]+$/, "Invalid phone number"),
  paymentType: z.enum(["FULL", "PARTIAL"]).default("FULL"),
});

/** Schema for paying the remaining 40% balance. */
export const payBalanceSchema = z.object({
  phoneNumber: z.string().min(9).max(15).regex(/^\+?[0-9]+$/, "Invalid phone number"),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;
export type UpdateCourseDto = z.infer<typeof updateCourseSchema>;
export type ListCoursesDto = z.infer<typeof listCoursesSchema>;
export type InitiateEnrollmentDto = z.infer<typeof initiateEnrollmentSchema>;
export type PayBalanceDto = z.infer<typeof payBalanceSchema>;
