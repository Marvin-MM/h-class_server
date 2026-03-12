import type { StreamClient } from "@stream-io/node-sdk";
import type { SessionsRepository } from "./repository.js";
import type { CoursesRepository } from "../courses/repository.js";
import type { CreateSessionDto } from "./dto.js";
import type { SessionResponse, JoinSessionResult } from "./types.js";
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
  ValidationError,
} from "../../shared/errors/index.js";
import { eventBus, AppEvents } from "../../shared/utils/event-bus.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Service handling session scheduling, state transitions, and GetStream Video integration.
 */
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly coursesRepository: CoursesRepository,
    private readonly streamVideoClient: StreamClient,
  ) {}

  /** Creates a new session. Course must have enrolled students. */
  async createSession(
    tutorId: string,
    dto: CreateSessionDto,
  ): Promise<SessionResponse> {
    const course = await this.coursesRepository.findById(dto.courseId);
    if (!course) throw new NotFoundError("Course", dto.courseId);
    if (course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only create sessions for your own courses",
      );

    // Check that the course has at least one enrolled student
    const enrollmentCount = await this.coursesRepository.countEnrollments(
      dto.courseId,
    );
    if (enrollmentCount === 0) {
      throw new ValidationError(
        "Cannot create a session for a course with no enrolled students",
      );
    }

    let duration = dto.duration;
    if (!duration) {
      if (dto.endTime) {
        duration = Math.round(
          (dto.endTime.getTime() - dto.scheduledAt.getTime()) / 60000,
        );
      } else {
        duration = 180; // Default max 3 hours
      }
    }

    // Create GetStream Video call with recording disabled
    let getStreamCallId: string | null = null;
    try {
      const callType = "default";
      const callId = `session-${Date.now()}`;
      const call = this.streamVideoClient.video.call(callType, callId);
      await call.create({
        data: {
          created_by_id: tutorId,
          starts_at: dto.scheduledAt,
          settings_override: {
            recording: { mode: "disabled" },
          },
        },
      });
      getStreamCallId = callId;
    } catch (error) {
      logger.error("Failed to create GetStream Video call", { error });
      // Continue without GetStream — the session can still be created
    }

    const session = await this.sessionsRepository.create({
      courseId: dto.courseId,
      title: dto.title,
      scheduledAt: dto.scheduledAt,
      duration,
      getStreamCallId,
    });

    // Emit event for notifications and calendar
    eventBus.emit(AppEvents.SESSION_SCHEDULED, {
      sessionId: session.id,
      courseId: dto.courseId,
      title: dto.title,
      scheduledAt: dto.scheduledAt,
      duration,
    });

    logger.info("Session created", {
      sessionId: session.id,
      courseId: dto.courseId,
    });
    return this.toResponse(session);
  }

  /** Gets a session by ID. */
  async getSession(sessionId: string): Promise<SessionResponse> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) throw new NotFoundError("Session", sessionId);
    return this.toResponse(session);
  }

  /** Lists sessions for a course. */
  async getCourseSessions(courseId: string): Promise<SessionResponse[]> {
    const sessions = await this.sessionsRepository.findByCourseId(courseId);
    return sessions.map(this.toResponse);
  }

  /** Starts a session (SCHEDULED → LIVE). */
  async startSession(
    sessionId: string,
    tutorId: string,
  ): Promise<SessionResponse> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) throw new NotFoundError("Session", sessionId);

    const course = await this.coursesRepository.findById(session.courseId);
    if (!course || course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only start sessions for your own courses",
      );
    if (session.status !== "SCHEDULED")
      throw new ConflictError("Only SCHEDULED sessions can be started");

    const updated = await this.sessionsRepository.updateStatus(
      sessionId,
      "LIVE",
    );

    // Transition course to IN_PROGRESS if it was PUBLISHED
    if (course.status === "PUBLISHED") {
      await this.coursesRepository.update(course.id, { status: "IN_PROGRESS" });
    }

    eventBus.emit(AppEvents.SESSION_STARTED, {
      sessionId,
      courseId: session.courseId,
    });
    logger.info("Session started", { sessionId });
    return this.toResponse(updated);
  }

  /** Ends a session (LIVE → ENDED). */
  async endSession(
    sessionId: string,
    tutorId: string,
  ): Promise<SessionResponse> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) throw new NotFoundError("Session", sessionId);

    const course = await this.coursesRepository.findById(session.courseId);
    if (!course || course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only end sessions for your own courses",
      );
    if (session.status !== "LIVE")
      throw new ConflictError("Only LIVE sessions can be ended");

    const updated = await this.sessionsRepository.updateStatus(
      sessionId,
      "ENDED",
    );

    // Terminate the Stream video call to force all participants out
    if (session.getStreamCallId) {
      try {
        const call = this.streamVideoClient.video.call(
          "default",
          session.getStreamCallId,
        );
        await call.end();
      } catch (err) {
        logger.error("Failed to end GetStream Video call explicitly", {
          err,
          sessionId,
        });
      }
    }

    eventBus.emit(AppEvents.SESSION_ENDED, {
      sessionId,
      courseId: session.courseId,
    });
    logger.info("Session ended", { sessionId });
    return this.toResponse(updated);
  }

  /** Generates a GetStream Video join token for a user. */
  async joinSession(
    sessionId: string,
    userId: string,
    userRole: string,
  ): Promise<JoinSessionResult> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) throw new NotFoundError("Session", sessionId);
    if (!session.getStreamCallId)
      throw new ConflictError("No video call configured for this session");

    if (session.status === "ENDED") {
      throw new ConflictError("Cannot join an ended session");
    }

    const course = await this.coursesRepository.findById(session.courseId);
    if (!course) throw new NotFoundError("Course", session.courseId);

    // Ownership check
    if (userRole === "TUTOR" && course.tutorId !== userId) {
      throw new AuthorizationError(
        "You can only join sessions for your own courses",
      );
    }
    if (userRole === "STUDENT") {
      const isEnrolled = await this.coursesRepository.isEnrolled(
        userId,
        session.courseId,
      );
      if (!isEnrolled)
        throw new AuthorizationError(
          "You must be enrolled in the course to join this session",
        );
    }

    // Generate GetStream Video token valid for 4 hours (covers max 3h session + padding)
    const exp = Math.floor(Date.now() / 1000) + 14400; // 4 hours
    const iat = Math.floor(Date.now() / 1000) - 10;
    const token = this.streamVideoClient.generateUserToken({
      user_id: userId,
      exp,
      iat,
    });

    return { token, callId: session.getStreamCallId };
  }

  private toResponse(session: {
    id: string;
    courseId: string;
    title: string;
    scheduledAt: Date;
    duration: number;
    status: string;
    getStreamCallId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SessionResponse {
    return {
      id: session.id,
      courseId: session.courseId,
      title: session.title,
      scheduledAt: session.scheduledAt,
      duration: session.duration,
      status: session.status,
      getStreamCallId: session.getStreamCallId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
