/**
 * Composition Root — central DI wiring.
 * All module instances are created here with manual constructor injection.
 * No DI framework is used; all dependencies are explicit.
 */

import { createPrismaClient } from './infrastructure/prisma.js';
import { createRedisClient } from './infrastructure/redis.js';
import { S3StorageClient } from './infrastructure/s3.js';
import { createStreamChatClient } from './infrastructure/stream-chat.js';
import { createStreamVideoClient } from './infrastructure/stream-video.js';
import { createStripeClient } from './infrastructure/stripe.js';
import { createQueues } from './infrastructure/bullmq.js';
import { registerAuditMiddleware } from './modules/audit/middleware.js';
import type { AppConfig } from './config/index.js';

// Repositories
import { AuthRepository } from './modules/auth/repository.js';
import { UsersRepository } from './modules/users/repository.js';
import { MediaRepository } from './modules/media/repository.js';
import { CoursesRepository } from './modules/courses/repository.js';
import { PaymentsRepository } from './modules/payments/repository.js';
import { SessionsRepository } from './modules/sessions/repository.js';
import { NotesRepository } from './modules/notes/repository.js';
import { AssessmentsRepository } from './modules/assessments/repository.js';
import { CertificatesRepository } from './modules/certificates/repository.js';
import { ChatRepository } from './modules/chat/repository.js';
import { NotificationsRepository } from './modules/notifications/repository.js';
import { DomainsRepository } from './modules/domains/repository.js';
import { CalendarRepository } from './modules/calendar/repository.js';
import { AdminRepository } from './modules/admin/repository.js';

// Services
import { AuthService } from './modules/auth/service.js';
import { UsersService } from './modules/users/service.js';
import { MediaService } from './modules/media/service.js';
import { CoursesService } from './modules/courses/service.js';
import { PaymentsService } from './modules/payments/service.js';
import { SessionsService } from './modules/sessions/service.js';
import { NotesService } from './modules/notes/service.js';
import { AssessmentsService } from './modules/assessments/service.js';
import { CertificatesService } from './modules/certificates/service.js';
import { ChatService } from './modules/chat/service.js';
import { NotificationsService } from './modules/notifications/service.js';
import { DomainsService } from './modules/domains/service.js';
import { CalendarService } from './modules/calendar/service.js';
import { AdminService } from './modules/admin/service.js';

// Stripe adapter
import { StripePaymentGateway } from './modules/payments/stripe-adapter.js';

// Controllers
import { AuthController } from './modules/auth/controller.js';
import { UsersController } from './modules/users/controller.js';
import { MediaController } from './modules/media/controller.js';
import { CoursesController } from './modules/courses/controller.js';
import { PaymentsController } from './modules/payments/controller.js';
import { SessionsController } from './modules/sessions/controller.js';
import { NotesController } from './modules/notes/controller.js';
import { AssessmentsController } from './modules/assessments/controller.js';
import { CertificatesController } from './modules/certificates/controller.js';
import { ChatController } from './modules/chat/controller.js';
import { NotificationsController } from './modules/notifications/controller.js';
import { DomainsController } from './modules/domains/controller.js';
import { CalendarController } from './modules/calendar/controller.js';
import { AdminController } from './modules/admin/controller.js';

/**
 * Creates and returns the entire dependency graph.
 * This is the single location where all wiring happens.
 */
export function createContainer(config: AppConfig) {
  // Infrastructure
  const prisma = createPrismaClient(config);
  const redis = createRedisClient(config);
  const s3Client = new S3StorageClient(config);
  const streamChatClient = createStreamChatClient(config);
  const streamVideoClient = createStreamVideoClient(config);
  const stripe = createStripeClient(config);

  // Register audit middleware on Prisma
  registerAuditMiddleware(prisma);

  // Queues — uses the existing createQueues factory
  const queues = createQueues({ connection: redis });

  // Payment gateway
  const paymentGateway = new StripePaymentGateway(stripe, config);

  // Repositories
  const authRepository = new AuthRepository(prisma);
  const usersRepository = new UsersRepository(prisma);
  const mediaRepository = new MediaRepository(prisma);
  const coursesRepository = new CoursesRepository(prisma);
  const paymentsRepository = new PaymentsRepository(prisma);
  const sessionsRepository = new SessionsRepository(prisma);
  const notesRepository = new NotesRepository(prisma);
  const assessmentsRepository = new AssessmentsRepository(prisma);
  const certificatesRepository = new CertificatesRepository(prisma);
  const chatRepository = new ChatRepository(prisma);
  const notificationsRepository = new NotificationsRepository(prisma);
  const domainsRepository = new DomainsRepository(prisma);
  const calendarRepository = new CalendarRepository(prisma);
  const adminRepository = new AdminRepository(prisma);

  // Services (order matters — dependencies first)
  const mediaService = new MediaService(s3Client);
  const notificationsService = new NotificationsService(notificationsRepository, queues.pushNotificationQueue);
  const authService = new AuthService(authRepository, redis, config, queues.emailQueue);
  const usersService = new UsersService(usersRepository, redis, mediaService);
  const coursesService = new CoursesService(coursesRepository, prisma, paymentGateway);
  const paymentsService = new PaymentsService(paymentsRepository, paymentGateway, prisma);
  const sessionsService = new SessionsService(sessionsRepository, coursesRepository, streamVideoClient);
  const notesService = new NotesService(notesRepository, coursesRepository);
  const assessmentsService = new AssessmentsService(assessmentsRepository, coursesRepository, mediaService);
  const certificatesService = new CertificatesService(certificatesRepository, queues.certificateCompilationQueue);
  const chatService = new ChatService(chatRepository, coursesRepository, streamChatClient, config.GETSTREAM_API_KEY);
  const domainsService = new DomainsService(domainsRepository, queues.domainProvisioningQueue);
  const calendarService = new CalendarService(calendarRepository, prisma);
  const adminService = new AdminService(adminRepository, paymentsRepository, notificationsService, queues.emailQueue);

  // Controllers
  const authController = new AuthController(authService, config);
  const usersController = new UsersController(usersService);
  const mediaController = new MediaController(mediaService);
  const coursesController = new CoursesController(coursesService);
  const paymentsController = new PaymentsController(paymentsService);
  const sessionsController = new SessionsController(sessionsService);
  const notesController = new NotesController(notesService);
  const assessmentsController = new AssessmentsController(assessmentsService);
  const certificatesController = new CertificatesController(certificatesService);
  const chatController = new ChatController(chatService);
  const notificationsController = new NotificationsController(notificationsService);
  const domainsController = new DomainsController(domainsService);
  const calendarController = new CalendarController(calendarService);
  const adminController = new AdminController(adminService);

  return {
    // Infrastructure (exposed for graceful shutdown)
    prisma,
    redis,

    // Controllers (exposed for route registration)
    authController,
    usersController,
    mediaController,
    coursesController,
    paymentsController,
    sessionsController,
    notesController,
    assessmentsController,
    certificatesController,
    chatController,
    notificationsController,
    domainsController,
    calendarController,
    adminController,

    // Config
    config,
  };
}

export type Container = ReturnType<typeof createContainer>;
