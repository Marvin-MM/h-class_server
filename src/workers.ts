/**
 * BullMQ Worker Entry Point.
 * Defines and starts all background job processors.
 * Run separately from the main HTTP server: `npx tsx src/workers.ts`
 */

import { Worker, type Job } from "bullmq";
import admin from "firebase-admin";
import { loadConfig } from "./config/env.js";
import { createRedisClient } from "./infrastructure/redis.js";
import { createPrismaClient } from "./infrastructure/prisma.js";
import { CloudflareClient } from "./infrastructure/cloudflare.js";
import { createMailTransport, sendEmail } from "./infrastructure/mailer.js";
import { initializeFirebase } from "./infrastructure/firebase.js";
import {
  EMAIL_QUEUE,
  PUSH_NOTIFICATION_QUEUE,
  CERTIFICATE_COMPILATION_QUEUE,
  DOMAIN_PROVISIONING_QUEUE,
  AUDIT_ARCHIVE_QUEUE,
} from "./infrastructure/bullmq.js";
import { logger } from "./shared/utils/logger.js";

const config = loadConfig();
const redis = createRedisClient(config);
const prisma = createPrismaClient(config);
const cloudflare = new CloudflareClient(config);
const mailTransport = createMailTransport(config);
initializeFirebase(config);

const connection = {
  host: redis.options.host ?? "localhost",
  port: redis.options.port ?? 6379,
};

// ─── Email Worker ────────────────────────────────────────────────
const emailWorker = new Worker(
  EMAIL_QUEUE,
  async (job: Job) => {
    const { to, subject, html, template, data } = job.data as {
      to: string;
      subject: string;
      html?: string;
      template?: string;
      data?: Record<string, string>;
    };

    let emailHtml = html ?? "";
    if (template && data) {
      emailHtml = renderTemplate(template, data);
    }

    await sendEmail(mailTransport, config.SMTP_FROM, {
      to,
      subject,
      html: emailHtml,
    });

    logger.info("Email sent", { to, subject, jobId: job.id });
  },
  { connection, concurrency: 5 },
);

// ─── Push Notification Worker ────────────────────────────────────
const pushWorker = new Worker(
  PUSH_NOTIFICATION_QUEUE,
  async (job: Job) => {
    const { userId, title, message } = job.data as {
      userId: string;
      title: string;
      message: string;
    };

    const tokens = await prisma.userPushToken.findMany({ where: { userId } });
    if (tokens.length === 0) {
      logger.info("No push tokens for user, skipping", { userId });
      return;
    }

    const messaging = admin.messaging();
    const tokenStrings = tokens.map((t) => t.token);

    try {
      // Execute efficient multicast network request natively supporting up to 500 tokens at once
      const response = await messaging.sendEachForMulticast({
        tokens: tokenStrings,
        notification: { title, body: message },
      });

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            // Only scrub definitive unregister/invalid codes, ignore transient network layer issues
            if (
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered"
            ) {
              failedTokens.push(tokenStrings[idx]!);
            }
          }
        });

        // Strip structurally permanently dead tokens in a single shot
        if (failedTokens.length > 0) {
          await prisma.userPushToken.deleteMany({
            where: { token: { in: failedTokens } },
          });
          logger.info("Purged inactive push tokens natively", { count: failedTokens.length });
        }
      }

      logger.info("Push notifications broadcast via Multicast", { userId, count: tokenStrings.length });
    } catch (error) {
       logger.error("Irrecoverable push notification failure", { error, userId });
       throw error;
    }
  },
  { connection, concurrency: 3 },
);

// ─── Certificate Compilation Worker ──────────────────────────────
const certificateWorker = new Worker(
  CERTIFICATE_COMPILATION_QUEUE,
  async (job: Job) => {
    const { certificateId, studentId, courseId } = job.data as {
      certificateId: string;
      studentId: string;
      courseId: string;
    };

    const [student, course, enrollment] = await Promise.all([
      prisma.user.findUnique({
        where: { id: studentId },
        select: { firstName: true, lastName: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, description: true },
      }),
      prisma.enrollment.findFirst({
        where: { userId: studentId, courseId },
        select: { createdAt: true },
      }),
    ]);

    const submissions = await prisma.submission.findMany({
      where: { studentId, assessment: { courseId } },
      include: { assessment: { select: { title: true, type: true } } },
    });

    const totalScore = submissions.reduce((sum, s) => sum + Number(s.score || 0), 0);
    const overallScore = submissions.length > 0 ? Number((totalScore / submissions.length).toFixed(2)) : 0;

    let gradeLetter = "F";
    if (overallScore >= 90) gradeLetter = "A";
    else if (overallScore >= 80) gradeLetter = "B";
    else if (overallScore >= 70) gradeLetter = "C";
    else if (overallScore >= 60) gradeLetter = "D";
    else if (overallScore >= 50) gradeLetter = "E";

    const certificateData = {
      studentName:
        `${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim(),
      studentEmail: student?.email ?? "",
      courseName: course?.title ?? "",
      courseDescription: course?.description ?? "",
      enrolledAt: enrollment?.createdAt?.toISOString() ?? "",
      completedAt: new Date().toISOString(),
      overallScore,
      gradeLetter,
      assessments: submissions.map(
        (s: {
          assessment: { title: string; type: string };
          score: unknown;
        }) => ({
          title: s.assessment.title,
          type: s.assessment.type,
          score: s.score !== null ? Number(s.score) : null,
        }),
      ),
    };

    await prisma.certificate.update({
      where: { id: certificateId },
      data: { data: certificateData, status: "ISSUED" },
    });

    logger.info("Certificate compiled and issued", {
      certificateId,
      studentId,
      courseId,
    });
  },
  { connection, concurrency: 2 },
);

// ─── Domain Provisioning Worker ──────────────────────────────────
const domainWorker = new Worker(
  DOMAIN_PROVISIONING_QUEUE,
  async (job: Job) => {
    const { domainId, subdomain } = job.data as {
      domainId: string;
      subdomain: string;
      userId: string;
    };

    try {
      const recordId = await cloudflare.createSubdomain(subdomain);

      await prisma.domain.update({
        where: { id: domainId },
        data: {
          status: "ACTIVE",
          cloudflareDnsRecordId: recordId,
        },
      });

      logger.info("Domain provisioned", { domainId, subdomain });
    } catch (error) {
      await prisma.domain.update({
        where: { id: domainId },
        data: { status: "FAILED" },
      });
      logger.error("Domain provisioning failed", {
        error,
        domainId,
        subdomain,
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
  },
);

// ─── Audit Log Archival Worker ───────────────────────────────────
const auditArchivalWorker = new Worker(
  AUDIT_ARCHIVE_QUEUE,
  async (_job: Job) => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });

    logger.info("Audit log archival completed", { deletedCount: result.count });
  },
  { connection, concurrency: 1 },
);

// ─── Template renderer ──────────────────────────────────────────
function renderTemplate(
  template: string,
  data: Record<string, string>,
): string {
  const templates: Record<string, (d: Record<string, string>) => string> = {
    welcome: (d) => `
      <h1>Welcome to H-Class LMS, ${d["firstName"]}!</h1>
      <p>Your account has been created successfully. Start exploring courses today.</p>
    `,
    "tutor-approved": (d) => `
      <h1>Congratulations, ${d["firstName"]}!</h1>
      <p>Your tutor application has been approved. You can now create and manage courses.</p>
    `,
    "tutor-denied": (d) => `
      <h1>Application Update</h1>
      <p>Dear ${d["firstName"]}, your tutor application was not approved.</p>
      <p>Reason: ${d["reason"]}</p>
    `,
  };

  const renderer = templates[template];
  if (!renderer) return `<p>Notification: ${template}</p>`;
  return renderer(data);
}

// ─── Worker Error Handlers ───────────────────────────────────────
const workers = [
  emailWorker,
  pushWorker,
  certificateWorker,
  domainWorker,
  auditArchivalWorker,
];

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    logger.error(`Worker job failed: ${worker.name}`, {
      jobId: job?.id,
      error: err,
    });
  });
  worker.on("error", (err) => {
    logger.error(`Worker error: ${worker.name}`, { error: err });
  });
}

logger.info("🔧 BullMQ workers started", {
  queues: [
    EMAIL_QUEUE,
    PUSH_NOTIFICATION_QUEUE,
    CERTIFICATE_COMPILATION_QUEUE,
    DOMAIN_PROVISIONING_QUEUE,
    AUDIT_ARCHIVE_QUEUE,
  ],
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down workers...`);
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
