import { Router } from "express";
import type { ChatController } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { createConversationSchema, sendMessageSchema } from "./dto.js";

export function createChatRouter(
  controller: ChatController,
  authMiddleware: ReturnType<
    typeof import("../../middleware/auth.js").createAuthMiddleware
  >,
): Router {
  const router = Router();
  router.use(authMiddleware);

  router.post("/", validate(createConversationSchema), controller.createConversation);
  router.get("/", controller.getUserConversations);
  router.post("/:id/messages", validate(sendMessageSchema), controller.sendMessage);
  router.get("/:id/messages", controller.getMessages);

  return router;
}
