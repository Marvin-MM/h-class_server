import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../shared/errors/index.js";
import { sendError } from "../shared/utils/response.js";
import { logger } from "../shared/utils/logger.js";

/**
 * Global error handler middleware.
 * Catches all errors thrown from route handlers and returns consistent error responses.
 *
 * - AppError instances are returned with their specific status codes and error codes.
 * - Prisma errors are mapped to appropriate AppError types.
 * - Unhandled errors are logged and returned as generic 500s.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle Prisma-specific errors by converting to AppError
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const converted = convertPrismaError(err);
    sendError(
      res,
      converted.statusCode,
      converted.errorCode,
      converted.message,
    );
    return;
  }

  // Handle known application errors
  if (err instanceof AppError) {
    if (err instanceof ValidationError) {
      sendError(res, err.statusCode, err.errorCode, err.message, err.details);
      return;
    }
    sendError(res, err.statusCode, err.errorCode, err.message);
    return;
  }

  // Handle improperly formatted multipart/form-data payloads (e.g. from Postman)
  if (err instanceof MulterError) {
    sendError(res, 400, "VALIDATION_ERROR", `Form upload error: ${err.message}`);
    return;
  }

  // Unhandled / unexpected errors
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
  });

  sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
}

/**
 * Converts Prisma client errors into appropriate AppError subclasses.
 */
function convertPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): AppError {
  switch (error.code) {
    case "P2002": {
      // Unique constraint violation
      const target =
        (error.meta?.["target"] as string[])?.join(", ") ?? "field";
      return new ConflictError(`A record with this ${target} already exists`);
    }
    case "P2025": {
      // Record not found
      return new NotFoundError("Record");
    }
    default: {
      return new AppError(
        `Database error: ${error.message}`,
        500,
        "DATABASE_ERROR",
        false,
      );
    }
  }
}
