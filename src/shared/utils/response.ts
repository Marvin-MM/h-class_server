import type { Response } from 'express';

/** Standard success response shape. */
interface SuccessResponse<T> {
  success: true;
  data: T;
}

/** Paginated success response shape. */
interface PaginatedResponse<T> {
  success: true;
  data: T;
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/** Standard error response shape. */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Sends a successful JSON response with the standard envelope.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: SuccessResponse<T> = { success: true, data };
  res.status(statusCode).json(body);
}

/**
 * Sends a paginated JSON response with the standard envelope.
 */
export function sendPaginated<T>(
  res: Response,
  data: T,
  meta: { page: number; pageSize: number; total: number },
  statusCode = 200,
): void {
  const body: PaginatedResponse<T> = { success: true, data, meta };
  res.status(statusCode).json(body);
}

/**
 * Sends an error JSON response with the standard envelope.
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, string[]>,
): void {
  const body: ErrorResponse = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  };
  res.status(statusCode).json(body);
}
