import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../shared/errors/index.js";

/** Specifies which part of the request to validate. */
export type ValidationTarget = "body" | "query" | "params";

/**
 * Creates a validation middleware that validates the specified request
 * property against a Zod schema before the controller runs.
 *
 * @param schema - The Zod schema to validate against
 * @param target - Which part of the request to validate (body, query, or params)
 */
export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const formattedErrors = formatZodErrors(result.error);
      next(new ValidationError("Validation failed", formattedErrors));
      return;
    }

    // Replace the request property with the parsed (and coerced) data.
    // In Express 5, req.query and req.params are read-only getters,
    // so only req.body can be directly reassigned.
    if (target === "body") {
      req.body = result.data;
    }
    next();
  };
}

/**
 * Formats Zod validation errors into a structured map of field → error messages.
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(issue.message);
  }

  return formatted;
}
