export interface CalendarEventResponse {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly createdAt: Date;
}
