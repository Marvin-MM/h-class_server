import { Router } from "express";
import type { DomainsController } from "./controller.js";
export function createDomainsRouter(
  controller: DomainsController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.post("/", controller.request);
  router.get("/me", controller.getMyDomain);
  return router;
}
