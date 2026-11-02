import { formatCheckinContext } from "../../wellbeing/checkinContext";
import type { MemoryInput, MemoryOutput } from "../types";

/**
 * Agent 3 - loads all memory sources: recent turns of this chat, the user's
 * own wellbeing check-in history, and short summaries of earlier chats.
 */
export async function memoryAgent(input: MemoryInput): Promise<MemoryOutput> {
  const { store, conversationId, userId } = input;

  // The just-persisted user turn is the last element, so it is the final message sent to the model.
  const chatHistory = store.getRecentMessages(conversationId, 12);
  const checkinContextText = formatCheckinContext(store.getCheckins(userId, 3));

  const cross = store.getCrossChatContext(userId, conversationId, 3);
  const crossChatContextText = cross.length
    ? `Memory from this user's previous chats (reference gently only if relevant today, never quote at length):\n` +
      cross.map((c) => `- "${c.title}" (${c.relativeTime}): user shared "${c.userSnippets.join(" / ")}"${c.assistantSummary ? `; guidance offered "${c.assistantSummary}"` : ""}`).join("\n")
    : "";

  return { chatHistory, checkinContextText, hasCheckinHistory: checkinContextText.length > 0, crossChatContextText, crossChat: cross };
}
