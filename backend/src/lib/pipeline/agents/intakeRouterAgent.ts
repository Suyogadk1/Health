import type { IntakeRouterInput, IntakeRouterOutput } from "../types";

/** Agent 1 - normalizes input, resolves (or creates) the conversation, persists the user turn. */
export async function intakeRouterAgent(input: IntakeRouterInput): Promise<IntakeRouterOutput> {
  const message = input.rawMessage.trim();
  const title = message.slice(0, 32) + (message.length > 32 ? "…" : "");
  const { id, isNew } = input.store.ensureConversation(input.rawConversationId, input.user.id, title);
  input.store.addMessage(id, input.user.id, "user", message);
  return { conversationId: id, message, isNewConversation: isNew };
}
