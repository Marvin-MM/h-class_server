/**
 * Express Application Builder.
 * Creates and configures the Express application with all middleware and routes.
 */

import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import type { Container } from "./container.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { asyncContextMiddleware } from "./middleware/async-context.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createRateLimiters } from "./middleware/rate-limiter.js";

// Route factories
import { createAuthRouter } from "./modules/auth/router.js";
import { createUsersRouter } from "./modules/users/router.js";
import { createMediaRouter } from "./modules/media/router.js";
import { createCoursesRouter } from "./modules/courses/router.js";
import { createPaymentsRouter } from "./modules/payments/router.js";
import { createSessionsRouter } from "./modules/sessions/router.js";
import { createNotesRouter } from "./modules/notes/router.js";
import { createAssessmentsRouter } from "./modules/assessments/router.js";
import { createCertificatesRouter } from "./modules/certificates/router.js";
import { createChatRouter } from "./modules/chat/router.js";
import { createNotificationsRouter } from "./modules/notifications/router.js";
import { createDomainsRouter } from "./modules/domains/router.js";
import { createCalendarRouter } from "./modules/calendar/router.js";
import { createAdminRouter } from "./modules/admin/router.js";

export function createApp(container: Container) {
  const app = express();

  // ─── Global Middleware ──────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: container.config.ALLOWED_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    }),
  );
  app.use(requestIdMiddleware);
  app.use(asyncContextMiddleware);

  // Morgan HTTP logging (skip in test)
  if (container.config.NODE_ENV !== "test") {
    app.use(morgan("combined"));
  }

  // Cookie parser
  app.use(cookieParser());

  // JSON body parser
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Rate Limiters ─────────────────────────────────────────────
  const authMiddleware = createAuthMiddleware(
    container.config,
    container.redis,
  );
  const { apiLimiter, authLimiter, uploadLimiter } = createRateLimiters(
    container.redis,
  );

  // Apply global API rate limit
  app.use("/api/", apiLimiter);

  // ─── Health Check ──────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ─── API Routes ────────────────────────────────────────────────
  const v1 = "/api/v1";

  app.use(
    `${v1}/auth`,
    createAuthRouter(container.authController, authMiddleware, authLimiter),
  );
  app.use(
    `${v1}/users`,
    createUsersRouter(container.usersController, authMiddleware, uploadLimiter),
  );
  app.use(
    `${v1}/media`,
    createMediaRouter(container.mediaController, authMiddleware, uploadLimiter),
  );
  app.use(
    `${v1}/courses`,
    createCoursesRouter(container.coursesController, authMiddleware),
  );
  app.use(
    `${v1}/payments`,
    createPaymentsRouter(container.paymentsController, authMiddleware),
  );
  app.use(
    `${v1}/sessions`,
    createSessionsRouter(container.sessionsController, authMiddleware),
  );
  app.use(
    `${v1}/notes`,
    createNotesRouter(container.notesController, authMiddleware, uploadLimiter),
  );
  app.use(
    `${v1}/assessments`,
    createAssessmentsRouter(
      container.assessmentsController,
      authMiddleware,
      uploadLimiter,
    ),
  );
  app.use(
    `${v1}/certificates`,
    createCertificatesRouter(container.certificatesController, authMiddleware),
  );
  app.use(
    `${v1}/chat`,
    createChatRouter(container.chatController, authMiddleware),
  );
  app.use(
    `${v1}/notifications`,
    createNotificationsRouter(
      container.notificationsController,
      authMiddleware,
    ),
  );
  app.use(
    `${v1}/domains`,
    createDomainsRouter(container.domainsController, authMiddleware),
  );
  app.use(
    `${v1}/calendar`,
    createCalendarRouter(container.calendarController, authMiddleware),
  );
  app.use(
    `${v1}/admin`,
    createAdminRouter(container.adminController, authMiddleware),
  );

  // ─── 404 Handler ───────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
      },
    });
  });

  // ─── Error Handler (must be last) ──────────────────────────────
  app.use(errorHandler);

  return app;
}
