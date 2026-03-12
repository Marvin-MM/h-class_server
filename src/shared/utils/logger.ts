import winston from "winston";

/** Fields that must be redacted from log output to protect PII. */
const PII_FIELDS = new Set([
  "password",
  "passwordHash",
  "email",
  "firstName",
  "lastName",
  "cardNumber",
  "cvv",
  "ssn",
  "token",
  "refreshToken",
  "accessToken",
  "privateKey",
]);

/**
 * Recursively redacts PII fields from an object for safe logging.
 */
function redactPii(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactPii);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (PII_FIELDS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactPii(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/** Custom Winston format that redacts PII fields from log metadata. */
const piiRedactionFormat = winston.format((info) => {
  if (info.metadata && typeof info.metadata === "object") {
    info.metadata = redactPii(info.metadata);
  }
  return info;
});

/**
 * Application logger configured with JSON output, timestamps, and PII redaction.
 */
export const logger = winston.createLogger({
  level: process.env["LOG_LEVEL"] ?? "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.metadata({
      fillExcept: ["message", "level", "timestamp", "stack"],
    }),
    piiRedactionFormat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "h-class-lms" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({
          all: process.env["NODE_ENV"] !== "production",
        }),
        process.env["NODE_ENV"] !== "production"
          ? winston.format.simple()
          : winston.format.json(),
      ),
    }),
  ],
});
