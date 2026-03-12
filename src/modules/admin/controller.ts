import type { Request, Response, NextFunction } from "express";
import type { AdminService } from "./service.js";
import type {
  ApplicationActionDto,
  UpdateConfigDto,
  CreateConfigDto,
} from "./dto.js";
import {
  auditLogQuerySchema,
  financialSummaryQuerySchema,
  deleteConfigSchema,
} from "./dto.js";
import { sendSuccess, sendPaginated } from "../../shared/utils/response.js";

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  getApplications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const status = req.query["status"] as string | undefined;
      const page = parseInt(req.query["page"] as string) || 1;
      const pageSize = parseInt(req.query["pageSize"] as string) || 20;
      const result = await this.adminService.getApplications(
        status,
        page,
        pageSize,
      );
      sendPaginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  };

  approveApplication = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.adminService.approveApplication(String(req.params["id"]));
      sendSuccess(res, { message: "Application approved" });
    } catch (error) {
      next(error);
    }
  };

  denyApplication = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.adminService.denyApplication(
        String(req.params["id"]),
        req.body as ApplicationActionDto,
      );
      sendSuccess(res, { message: "Application denied" });
    } catch (error) {
      next(error);
    }
  };

  getConfig = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      sendSuccess(res, await this.adminService.getConfig());
    } catch (error) {
      next(error);
    }
  };

  createConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const config = await this.adminService.createConfig(
        req.body as CreateConfigDto,
      );
      sendSuccess(res, config, 201);
    } catch (error) {
      next(error);
    }
  };

  updateConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.adminService.updateConfig(req.body as UpdateConfigDto),
      );
    } catch (error) {
      next(error);
    }
  };

  deleteConfig = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = deleteConfigSchema.parse(req.body);
      await this.adminService.deleteConfig(dto.key);
      sendSuccess(res, { message: `Config key "${dto.key}" deleted` });
    } catch (error) {
      next(error);
    }
  };

  getAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = auditLogQuerySchema.parse(req.query);
      const result = await this.adminService.getAuditLogs(dto);
      sendPaginated(res, result.data, {
        page: dto.page,
        pageSize: dto.pageSize,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  };

  getFinancialSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = financialSummaryQuerySchema.parse(req.query);
      sendSuccess(res, await this.adminService.getFinancialSummary(dto));
    } catch (error) {
      next(error);
    }
  };
}
