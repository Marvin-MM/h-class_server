import type { Request, Response, NextFunction } from "express";
import type { PaymentsService } from "./service.js";
import type { ConnectOnboardingDto } from "./dto.js";
import { sendSuccess, sendPaginated } from "../../shared/utils/response.js";

/**
 * Controller for payment endpoints.
 */
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments/webhook
   * CRITICAL: Must receive the raw body (before JSON parsing) for Stripe signature verification.
   */
  handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      // req.body is the raw Buffer when express.raw() is used on this route
      await this.paymentsService.handleWebhookEvent(
        req.body as Buffer,
        signature,
      );
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  };

  /** POST /payments/connect/onboarding */
  connectOnboarding = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as ConnectOnboardingDto;
      const result = await this.paymentsService.createConnectOnboarding(
        req.user!.userId,
        req.user!.role,
        dto.refreshUrl,
        dto.returnUrl,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** GET /payments/transactions */
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
}
