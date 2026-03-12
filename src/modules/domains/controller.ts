import type { Request, Response, NextFunction } from "express";
import type { DomainsService } from "./service.js";
import { sendSuccess } from "../../shared/utils/response.js";

export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  request = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.domainsService.requestDomain(req.user!.userId);
      sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  };

  getMyDomain = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.domainsService.getUserDomain(req.user!.userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
