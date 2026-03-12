import type { JwtPayload } from "../middleware/auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Unique request ID for log correlation. */
      requestId?: string;
      /** Authenticated user info, set by the auth middleware. */
      user?: JwtPayload;
    }
  }
}

export {};
