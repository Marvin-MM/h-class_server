import type { PrismaClient } from '@prisma/client';
import type { CoursesRepository } from './repository.js';
import type { CreateCourseDto, UpdateCourseDto, ListCoursesDto } from './dto.js';
import type { CourseResponse, EnrollmentInitResult } from './types.js';
import type { IPaymentGateway } from '../payments/gateway.js';
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
  ValidationError,
} from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Service handling all course-related business logic.
 */
export class CoursesService {
  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly prisma: PrismaClient,
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  /**
   * Creates a new course in DRAFT status.
   * Only tutors can create courses. Commission rate is snapshotted at creation.
   */
  async createCourse(tutorId: string, dto: CreateCourseDto): Promise<CourseResponse> {
    // Get current platform commission from app_config
    const configRow = await this.prisma.appConfig.findUnique({
      where: { key: 'platform_commission_rate' },
    });
    const commissionRate = configRow ? parseFloat(configRow.value) : 10; // Default 10%

    const course = await this.coursesRepository.create({
      tutorId,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      passMark: dto.passMark,
      commissionRate,
    });

    logger.info('Course created', { courseId: course.id, tutorId });
    return this.toResponse(course);
  }

  /** Retrieves a course by ID. */
  async getCourse(courseId: string): Promise<CourseResponse> {
    const course = await this.coursesRepository.findByIdWithTutor(courseId);
    if (!course) {
      throw new NotFoundError('Course', courseId);
    }
    return this.toResponse(course);
  }

  /** Lists courses with pagination and filters. */
  async listCourses(dto: ListCoursesDto) {
    const result = await this.coursesRepository.findMany({
      pagination: { page: dto.page, pageSize: dto.pageSize },
      status: dto.status,
      tutorId: dto.tutorId,
      search: dto.search,
    });

    return {
      data: result.data.map((c) => this.toResponse(c)),
      meta: { page: dto.page, pageSize: dto.pageSize, total: result.total },
    };
  }

  /** Updates a course. Only the owning tutor can update. */
  async updateCourse(courseId: string, tutorId: string, dto: UpdateCourseDto): Promise<CourseResponse> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError('Course', courseId);
    }
    if (course.tutorId !== tutorId) {
      throw new AuthorizationError('You can only update your own courses');
    }

    const updated = await this.coursesRepository.update(courseId, dto as unknown as Parameters<typeof this.coursesRepository.update>[1]);
    logger.info('Course updated', { courseId, tutorId });
    return this.toResponse(updated);
  }

  /** Publishes a DRAFT course so it becomes visible. */
  async publishCourse(courseId: string, tutorId: string): Promise<CourseResponse> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError('Course', courseId);
    if (course.tutorId !== tutorId) throw new AuthorizationError('You can only publish your own courses');
    if (course.status !== 'DRAFT') throw new ConflictError('Only DRAFT courses can be published');

    const updated = await this.coursesRepository.update(courseId, { status: 'PUBLISHED' });
    logger.info('Course published', { courseId });
    return this.toResponse(updated);
  }

  /** Marks a course as COMPLETED. Triggers final assessment flow. */
  async completeCourse(courseId: string, tutorId: string): Promise<CourseResponse> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError('Course', courseId);
    if (course.tutorId !== tutorId) throw new AuthorizationError('You can only complete your own courses');
    if (course.status !== 'IN_PROGRESS') throw new ConflictError('Only IN_PROGRESS courses can be completed');

    const updated = await this.coursesRepository.update(courseId, { status: 'COMPLETED' });
    logger.info('Course completed', { courseId });
    return this.toResponse(updated);
  }

  /** Archives a course. Admin only. */
  async archiveCourse(courseId: string): Promise<CourseResponse> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError('Course', courseId);

    const updated = await this.coursesRepository.update(courseId, { status: 'ARCHIVED' });
    logger.info('Course archived', { courseId });
    return this.toResponse(updated);
  }

  /**
   * Initiates the enrollment payment flow.
   * Uses a row-level lock in a transaction to prevent race conditions.
   * Returns the Stripe client secret so the frontend can complete payment.
   */
  async initiateEnrollment(courseId: string, userId: string): Promise<EnrollmentInitResult> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the course row
      const course = await this.coursesRepository.findByIdForUpdate(courseId, tx);
      if (!course) throw new NotFoundError('Course', courseId);
      if (course.status !== 'PUBLISHED') throw new ConflictError('Course is not available for enrollment');

      // Check if already enrolled
      const isEnrolled = await this.coursesRepository.isEnrolled(userId, courseId);
      if (isEnrolled) throw new ConflictError('You are already enrolled in this course');

      // Create Stripe PaymentIntent with idempotency key
      const idempotencyKey = `enroll:${userId}:${courseId}`;
      const priceInCents = Math.round(Number(course.price) * 100);

      const paymentIntent = await this.paymentGateway.createPaymentIntent({
        amount: priceInCents,
        currency: 'usd',
        metadata: {
          courseId,
          userId,
          commissionRate: course.commissionRate.toString(),
          tutorId: course.tutorId,
        },
        idempotencyKey,
      });

      logger.info('Enrollment payment initiated', { courseId, userId, paymentIntentId: paymentIntent.id });

      return {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id,
      };
    });
  }

  /** Gets the roster of enrolled students for a tutor's course. */
  async getCourseStudents(courseId: string, tutorId: string, page: number, pageSize: number) {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError('Course', courseId);
    if (course.tutorId !== tutorId) throw new AuthorizationError('You can only view students for your own courses');

    return this.coursesRepository.findEnrollments(courseId, { page, pageSize });
  }

  /** Gets a student's own enrollments. */
  async getMyEnrollments(userId: string, page: number, pageSize: number) {
    return this.coursesRepository.findStudentEnrollments(userId, { page, pageSize });
  }

  private toResponse(course: {
    id: string;
    tutorId: string;
    title: string;
    description: string;
    status: string;
    price: unknown;
    passMark: unknown;
    commissionRate: unknown;
    createdAt: Date;
    updatedAt: Date;
    tutor?: { id: string; firstName: string; lastName: string };
  }): CourseResponse {
    return {
      id: course.id,
      tutorId: course.tutorId,
      title: course.title,
      description: course.description,
      status: course.status,
      price: String(course.price),
      passMark: String(course.passMark),
      commissionRate: String(course.commissionRate),
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      ...(course.tutor ? { tutor: course.tutor } : {}),
    };
  }
}
