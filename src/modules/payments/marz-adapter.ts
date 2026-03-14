import type { IPaymentGateway, CollectParams, GatewayResponse } from "./gateway.js";
import type { AppConfig } from "../../config/index.js";
import { logger } from "../../shared/utils/logger.js";

type MarzStatus = "pending" | "success" | "failed";

function normaliseMarzStatus(raw: string): MarzStatus {
  const s = raw.toLowerCase();
  if (["completed", "success", "successful"].includes(s)) return "success";
  if (["pending", "processing", "initiated"].includes(s)) return "pending";
  return "failed";
}

/**
 * Marz Pay implementation of IPaymentGateway.
 * This is the ONLY file that communicates with the Marz API.
 *
 * Swap the entire payment provider by creating another class that implements
 * IPaymentGateway (e.g. FlutterwavePaymentGateway) — no other file needs changing.
 */
export class MarzPaymentGateway implements IPaymentGateway {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly config: AppConfig) {
    this.baseUrl = config.MARZ_API_BASE_URL;
    this.authHeader = `Basic ${config.MARZ_API_BASE64_AUTH}`;
  }

  /** Initiates a mobile-money collection request. */
  async collectMoney(params: CollectParams): Promise<GatewayResponse> {
    try {
      const body = new URLSearchParams({
        phone_number: params.phoneNumber,
        amount: String(params.amount),
        country: "UG",
        reference: params.reference,
        description: params.description ?? "",
      });
      if (params.callbackUrl) body.append("callback_url", params.callbackUrl);

      const res = await fetch(`${this.baseUrl}/collect-money`, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = (await res.json()) as {
        status?: string;
        message?: string;
        data?: { transaction?: { uuid?: string; reference?: string; status?: string } };
      };

      const txData = data.data?.transaction ?? {};
      const success = data.status === "success";
      const status = normaliseMarzStatus(
        txData.status ?? (success ? "pending" : "failed"),
      );

      return {
        success,
        status,
        providerUuid: txData.uuid ?? txData.reference ?? params.reference,
        message: data.message ?? "Marz collection initiated",
        rawData: data,
      };
    } catch (error) {
      logger.error("MarzPaymentGateway.collectMoney error", { error, params });
      return {
        success: false,
        status: "failed",
        providerUuid: params.reference,
        message: error instanceof Error ? error.message : "Network error during collection",
        rawData: { error: String(error) },
      };
    }
  }

  /** Polls Marz for the definitive status of a payment. */
  async checkStatus(providerUuid: string): Promise<GatewayResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/collect-money/${providerUuid}`, {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
      });

      const data = (await res.json()) as Record<string, unknown>;
      const tx =
        (data["transaction"] as Record<string, unknown>) ??
        (data["data"] as Record<string, unknown>)?.["transaction"] ??
        (data["data"] as Record<string, unknown>) ??
        {};

      const rawStatus = String((tx["status"] ?? data["status"] ?? "unknown"));
      const status = normaliseMarzStatus(rawStatus);

      return {
        success: status === "success",
        status,
        providerUuid: String(tx["uuid"] ?? providerUuid),
        message: String(tx["description"] ?? data["message"] ?? "Status check complete"),
        rawData: data,
      };
    } catch (error) {
      logger.error("MarzPaymentGateway.checkStatus error", { error, providerUuid });
      // Return "pending" so BullMQ retries rather than marking the payment failed
      return {
        success: false,
        status: "pending",
        providerUuid,
        message: error instanceof Error ? error.message : "Network error during status check",
        rawData: { error: String(error) },
      };
    }
  }

  /** Returns the current Marz float balance. */
  async getBalance(): Promise<number> {
    const res = await fetch(`${this.baseUrl}/balance`, {
      method: "GET",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = (await res.json()) as {
      status?: string;
      message?: string;
      data?: { account?: { balance?: string | number | { raw?: string } } };
    };

    if (data.status !== "success") {
      throw new Error(data.message ?? "Marz balance check failed");
    }

    const balance = data.data?.account?.balance;
    if (typeof balance === "object" && balance !== null && "raw" in balance) {
      return parseFloat(balance.raw as string);
    }
    return parseFloat(String(balance ?? "0"));
  }
}
