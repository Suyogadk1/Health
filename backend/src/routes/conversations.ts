import { Router, Response } from "express";
import { store } from "../lib/store/store";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

export const conversationsRouter = Router();

// Protect all conversation routes with requireAuth
conversationsRouter.use(requireAuth);

conversationsRouter.get("/", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const list = store.getConversations(userId);
  return res.json({ data: list });
});

conversationsRouter.get("/context", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const currentConversationId = req.query.conversationId as string | undefined;
  const context = store.getCrossChatContext(userId, currentConversationId);
  return res.json({ data: context });
});

conversationsRouter.get("/:id", (req: AuthenticatedRequest, res: Response) => {
  const conversation = store.getConversation(req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  // Enforce user ownership of conversation
  if (conversation.user_id && conversation.user_id !== req.user!.id) {
    return res.status(403).json({ error: "Forbidden: Cannot access conversation owned by another user" });
  }
  const messages = store.getMessages(req.params.id);
  return res.json({ data: { ...conversation, messages } });
});

conversationsRouter.post("/", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { title } = req.body || {};
  const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const convo = store.createConversation(id, userId, title || "Mindful conversation");
  return res.json({ data: convo });
});

conversationsRouter.delete("/:id", (req: AuthenticatedRequest, res: Response) => {
  const conversation = store.getConversation(req.params.id);
  if (conversation && conversation.user_id && conversation.user_id !== req.user!.id) {
    return res.status(403).json({ error: "Forbidden: Cannot delete conversation owned by another user" });
  }
  const success = store.deleteConversation(req.params.id);
  return res.json({ success });
});
