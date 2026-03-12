import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { AppConfig } from "../config/index.js";
import { logger } from "../shared/utils/logger.js";

/** Email options for sending a message. */
export interface EmailOptions {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text?: string;
}

/**
 * Creates a Nodemailer SMTP transport.
 * Configured for Gmail SMTP in development, swappable for any SMTP provider in production.
 */
export function createMailTransport(config: AppConfig): Transporter {
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  logger.info("Mail transport created", {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
  });
  return transporter;
}

/**
 * Sends an email using the provided transport.
 * @param transporter - The Nodemailer transport
 * @param from - The sender address
 * @param options - Email options
 */
export async function sendEmail(
  transporter: Transporter,
  from: string,
  options: EmailOptions,
): Promise<void> {
  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  logger.info("Email sent", { to: options.to, subject: options.subject });
}
