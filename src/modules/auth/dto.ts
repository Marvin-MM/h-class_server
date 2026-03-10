import { z } from 'zod';

/** Schema for user registration. */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
    ),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
});

/** Schema for user login. */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Schema for tutor application. */
export const tutorApplicationSchema = z.object({
  // Minimal payload — the application itself is the signal
  // Additional fields can be added here as the spec evolves
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type TutorApplicationDto = z.infer<typeof tutorApplicationSchema>;
