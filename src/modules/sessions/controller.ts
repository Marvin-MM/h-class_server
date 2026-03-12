import type { Request, Response, NextFunction } from "express";
import type { SessionsService } from "./service.js";
import type { CreateSessionDto } from "./dto.js";
import { sendSuccess } from "../../shared/utils/response.js";

export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.sessionsService.createSession(
        req.user!.userId,
        req.body as CreateSessionDto,
      );
      sendSuccess(res, session, 201);
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.sessionsService.getSession(
        String(req.params["id"]),
      );
      sendSuccess(res, session);
    } catch (error) {
      next(error);
    }
  };

  getByCourse = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const sessions = await this.sessionsService.getCourseSessions(
        String(req.params["courseId"]),
      );
      sendSuccess(res, sessions);
    } catch (error) {
      next(error);
    }
  };

  start = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.sessionsService.startSession(
        String(req.params["id"]),
        req.user!.userId,
      );
      sendSuccess(res, session);
    } catch (error) {
      next(error);
    }
  };

  end = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await this.sessionsService.endSession(
        String(req.params["id"]),
        req.user!.userId,
      );
      sendSuccess(res, session);
    } catch (error) {
      next(error);
    }
  };

  join = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.sessionsService.joinSession(
        String(req.params["id"]),
        req.user!.userId,
        req.user!.role,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
