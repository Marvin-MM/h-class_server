import type { PrismaClient } from '@prisma/client';
import ICalCalendar, { ICalCalendarMethod } from 'ical-generator';
import type { CalendarRepository } from './repository.js';
import type { CalendarEventResponse } from './types.js';
import { eventBus, AppEvents, type SessionScheduledPayload } from '../../shared/utils/event-bus.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Service managing calendar events. Listens for session scheduled events
 * and creates calendar entries for tutors and enrolled students.
 */
export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly prisma: PrismaClient,
  ) {
    this.registerEventListeners();
  }

  /** Gets calendar events for a user within a date range. */
  async getEvents(userId: string, startDate: Date, endDate: Date): Promise<CalendarEventResponse[]> {
    const events = await this.calendarRepository.findByUserIdAndDateRange(userId, startDate, endDate);
    return events.map(this.toResponse);
  }

  /** Exports all calendar events as iCal format. */
  async exportIcal(userId: string): Promise<string> {
    const events = await this.calendarRepository.findByUserId(userId);
    const cal = ICalCalendar({ name: 'H-Class LMS Calendar', method: ICalCalendarMethod.PUBLISH });

    for (const event of events) {
      const icalEvent = cal.createEvent({
        start: event.startsAt,
        end: event.endsAt,
        summary: event.title,
      });
      icalEvent.uid(event.id);
    }

    return cal.toString();
  }

  /** Handles session scheduled event — creates calendar entries for tutor + enrolled students. */
  private async handleSessionScheduled(payload: SessionScheduledPayload): Promise<void> {
    const { sessionId, courseId, title, scheduledAt, duration } = payload;
    const endsAt = new Date(scheduledAt.getTime() + duration * 60 * 1000);

    // Get the course tutor
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { tutorId: true } });
    if (!course) return;

    // Get all enrolled students
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });

    // Create calendar entries for all participants
    const calendarEntries = [
      { userId: course.tutorId, sessionId, title, startsAt: scheduledAt, endsAt },
      ...enrollments.map((e) => ({
        userId: e.userId, sessionId, title, startsAt: scheduledAt, endsAt,
      })),
    ];

    await this.calendarRepository.createMany(calendarEntries);
    logger.info('Calendar entries created', { sessionId, count: calendarEntries.length });
  }

  private registerEventListeners(): void {
    eventBus.on(AppEvents.SESSION_SCHEDULED, (payload) => {
      this.handleSessionScheduled(payload).catch((error) => {
        logger.error('Failed to create calendar entries', { error, payload });
      });
    });
  }

  private toResponse(e: { id: string; userId: string; sessionId: string; title: string; startsAt: Date; endsAt: Date; createdAt: Date }): CalendarEventResponse {
    return { id: e.id, userId: e.userId, sessionId: e.sessionId, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, createdAt: e.createdAt };
  }
}
