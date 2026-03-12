/**
 * Base application error class.
 * All custom error types extend this class.
 */
export class AppError extends Error {
  /** HTTP status code to return. */
  public readonly statusCode: number;
  /** Application-level error code for frontend consumption. */
  public readonly errorCode: string;
  /** Whether this error is operational (expected) vs. programming error. */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/** HTTP 400 — request body, query, or params failed validation. */
export class ValidationError extends AppError {
  /** Structured validation error details. */
  public readonly details: Record<string, string[]>;

  constructor(message: string, details: Record<string, string[]> = {}) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}

/** HTTP 401 — missing or invalid authentication credentials. */
export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

/** HTTP 403 — authenticated but not authorised for this action. */
export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

/** HTTP 404 — resource not found. */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const msg = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(msg, 404, "NOT_FOUND");
  }
}

/** HTTP 409 — resource conflict (duplicate, state conflict, etc). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

/** HTTP 402 / 500 — payment-related error. */
export class PaymentError extends AppError {
  constructor(message: string, statusCode = 402) {
    super(message, statusCode, "PAYMENT_ERROR");
  }
}

/** HTTP 502 — an external service call failed. */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`${service}: ${message}`, 502, "EXTERNAL_SERVICE_ERROR");
  }
}
