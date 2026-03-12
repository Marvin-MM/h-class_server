import { Router } from "express";
import type { CalendarController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { calendarQuerySchema } from "./dto.js";

export function createCalendarRouter(
  controller: CalendarController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.get(
    "/events",
    validate(calendarQuerySchema, "query"),
    controller.getEvents,
  );
  router.get("/export/ical", controller.exportIcal);
  return router;
}
