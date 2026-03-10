import type { Request, Response, NextFunction } from 'express';
import type { CalendarService } from './service.js';
import type { CalendarQueryDto } from './dto.js';
import { sendSuccess } from '../../shared/utils/response.js';

export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  getEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as CalendarQueryDto;
      const events = await this.calendarService.getEvents(req.user!.userId, query.startDate, query.endDate);
      sendSuccess(res, events);
    } catch (error) { next(error); }
  };

  exportIcal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ical = await this.calendarService.exportIcal(req.user!.userId);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      res.send(ical);
    } catch (error) { next(error); }
  };
}
