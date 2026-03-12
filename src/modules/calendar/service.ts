import type { PrismaClient } from "@prisma/client";
import ICalCalendar, { ICalCalendarMethod } from "ical-generator";
import type { CalendarRepository } from "./repository.js";
import type { CalendarEventResponse } from "./types.js";

/**
 * Service managing calendar events. Fetching is natively bonded to existing active Sessions
 * solving past issues surrounding static duplication, syncing errors, and new enrollments.
 */
export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly prisma: PrismaClient,
  ) {}

  /** Gets calendar events for a user within a date range dynamically. */
  async getEvents(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEventResponse[]> {
    const sessions = await this.calendarRepository.findUserEventsAndDateRange(
      userId,
      startDate,
      endDate,
    );
    return sessions.map((s) => this.toResponse(s));
  }

  /** Exports all calendar events dynamically as iCal format. */
  async exportIcal(userId: string): Promise<string> {
    const sessions = await this.calendarRepository.findUserEvents(userId);
    const cal = ICalCalendar({
      name: "H-Class LMS Calendar",
      method: ICalCalendarMethod.PUBLISH,
    });

    for (const session of sessions) {
      const startsAt = session.scheduledAt;
      const endsAt = new Date(startsAt.getTime() + session.duration * 60 * 1000);

      const icalEvent = cal.createEvent({
        start: startsAt,
        end: endsAt,
        summary: `[${session.course.title}] ${session.title}`,
      });
      icalEvent.uid(session.id);
    }

    return cal.toString();
  }

  private toResponse(e: any): CalendarEventResponse {
    const startsAt = e.scheduledAt;
    const endsAt = new Date(startsAt.getTime() + e.duration * 60 * 1000);
    return {
      id: e.id,
      userId: "", // Deprecated field essentially, let it be empty since it's dynamic
      sessionId: e.id,
      title: `[${e.course.title}] ${e.title}`,
      startsAt,
      endsAt,
      createdAt: e.createdAt,
    };
  }
}
