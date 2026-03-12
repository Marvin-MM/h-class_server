import { cleanEnv, str, port, num, url } from "envalid";
import dotenv from "dotenv";
dotenv.config();

/** Validated environment configuration for the application. */
export interface AppConfig {
  readonly NODE_ENV: string;
  readonly PORT: number;
  readonly LOG_LEVEL: string;
  readonly ALLOWED_ORIGIN: string;
  readonly COOKIE_DOMAIN: string;
  readonly DATABASE_URL: string;
  readonly REDIS_URL: string;
  readonly JWT_SECRET: string;
  readonly JWT_ACCESS_EXPIRY: string;
  readonly JWT_REFRESH_EXPIRY: string;
  readonly AWS_REGION: string;
  readonly AWS_ACCESS_KEY_ID: string;
  readonly AWS_SECRET_ACCESS_KEY: string;
  readonly S3_BUCKET_NAME: string;
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly STRIPE_PUBLISHABLE_KEY: string;
  readonly GETSTREAM_API_KEY: string;
  readonly GETSTREAM_API_SECRET: string;
  readonly GETSTREAM_APP_ID: string;
  readonly CLOUDFLARE_API_TOKEN: string;
  readonly CLOUDFLARE_ZONE_ID: string;
  readonly PLATFORM_ROOT_DOMAIN: string;
  readonly FIREBASE_PROJECT_ID: string;
  readonly FIREBASE_CLIENT_EMAIL: string;
  readonly FIREBASE_PRIVATE_KEY: string;
  readonly SMTP_HOST: string;
  readonly SMTP_PORT: number;
  readonly SMTP_USER: string;
  readonly SMTP_PASS: string;
  readonly SMTP_FROM: string;
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
}

/**
 * Validates all required environment variables at startup.
 * The application will crash immediately if any required variable is missing or malformed.
 */
export function loadConfig(): AppConfig {
  const env = cleanEnv(process.env, {
    NODE_ENV: str({
      choices: ["development", "production", "test"],
      default: "development",
      desc: "Application environment",
    }),
    PORT: port({ default: 3000, desc: "HTTP server port" }),
    LOG_LEVEL: str({
      default: "info",
      choices: ["error", "warn", "info", "http", "debug"],
      desc: "Winston log level",
    }),
    ALLOWED_ORIGIN: str({ desc: "Allowed CORS origin" }),
    COOKIE_DOMAIN: str({ desc: "Domain for HTTP cookies" }),
    DATABASE_URL: url({ desc: "PostgreSQL connection string" }),
    REDIS_URL: str({ desc: "Redis connection URL" }),
    JWT_SECRET: str({ desc: "Secret key for signing JWTs" }),
    JWT_ACCESS_EXPIRY: str({ default: "15m", desc: "JWT access token expiry" }),
    JWT_REFRESH_EXPIRY: str({
      default: "7d",
      desc: "JWT refresh token expiry",
    }),
    AWS_REGION: str({ desc: "AWS region for S3" }),
    AWS_ACCESS_KEY_ID: str({ desc: "AWS access key ID" }),
    AWS_SECRET_ACCESS_KEY: str({ desc: "AWS secret access key" }),
    S3_BUCKET_NAME: str({ desc: "S3 bucket name for file uploads" }),
    STRIPE_SECRET_KEY: str({ desc: "Stripe secret API key" }),
    STRIPE_WEBHOOK_SECRET: str({ desc: "Stripe webhook signing secret" }),
    STRIPE_PUBLISHABLE_KEY: str({ desc: "Stripe publishable key" }),
    GETSTREAM_API_KEY: str({ desc: "GetStream API key" }),
    GETSTREAM_API_SECRET: str({ desc: "GetStream API secret" }),
    GETSTREAM_APP_ID: str({ desc: "GetStream application ID" }),
    CLOUDFLARE_API_TOKEN: str({ desc: "Cloudflare API bearer token" }),
    CLOUDFLARE_ZONE_ID: str({ desc: "Cloudflare DNS zone ID" }),
    PLATFORM_ROOT_DOMAIN: str({ desc: "Platform root domain for subdomains" }),
    FIREBASE_PROJECT_ID: str({ desc: "Firebase project ID" }),
    FIREBASE_CLIENT_EMAIL: str({
      desc: "Firebase service account client email",
    }),
    FIREBASE_PRIVATE_KEY: str({ desc: "Firebase service account private key" }),
    SMTP_HOST: str({ default: "smtp.gmail.com", desc: "SMTP server hostname" }),
    SMTP_PORT: num({ default: 587, desc: "SMTP server port" }),
    SMTP_USER: str({ desc: "SMTP authentication user" }),
    SMTP_PASS: str({ desc: "SMTP authentication password" }),
    SMTP_FROM: str({ desc: "Default From address for emails" }),
    CLOUDINARY_CLOUD_NAME: str({
      desc: "Cloudinary cloud name for image uploads",
    }),
    CLOUDINARY_API_KEY: str({ desc: "Cloudinary API key" }),
    CLOUDINARY_API_SECRET: str({ desc: "Cloudinary API secret" }),
  });

  return env as unknown as AppConfig;
}
