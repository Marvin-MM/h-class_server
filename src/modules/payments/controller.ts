import type { Request, Response, NextFunction } from "express";
import type { PaymentsService } from "./service.js";
import type {
  InitiatePaymentDto,
  InitiateBalancePaymentDto,
  FinancialSummaryDto,
} from "./dto.js";
import { sendSuccess, sendPaginated } from "../../shared/utils/response.js";
import { roleGuard } from "../../middleware/role-guard.js";
import { AuthorizationError } from "../../shared/errors/index.js";

/**
 * Controller for payment endpoints.
 */
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** POST /payments/initiate — Student initiates course enrollment payment. */
  initiatePayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as InitiatePaymentDto;
      const result = await this.paymentsService.initiatePayment(
        req.user!.userId,
        dto.courseId,
        dto.phoneNumber,
        dto.paymentType,
      );
      sendSuccess(res, result, 202);
    } catch (error) {
      next(error);
    }
  };

  /** POST /payments/initiate-balance — Student pays remaining 40% balance. */
  initiateBalancePayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as InitiateBalancePaymentDto;
      const result = await this.paymentsService.initiateBalancePayment(
        req.user!.userId,
        dto.courseId,
        dto.phoneNumber,
      );
      sendSuccess(res, result, 202);
    } catch (error) {
      next(error);
    }
  };

  /** GET /payments/transactions — User's own transaction history. */
  getTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = parseInt(req.query["page"] as string) || 1;
      const pageSize = parseInt(req.query["pageSize"] as string) || 20;
      const result = await this.paymentsService.getUserTransactions(
        req.user!.userId,
        page,
        pageSize,
      );
      sendPaginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  };

  /** GET /payments/summary — Admin: aggregated financial summary. */
  getFinancialSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.query as unknown as FinancialSummaryDto;
      const result = await this.paymentsService.getFinancialSummary(
        dto.startDate,
        dto.endDate,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
