import { store } from "../store/store";
import type { ConversationStore } from "./types";

/** Adapts the backend in-memory store to the pipeline's ConversationStore interface. */
export const memoryStoreAdapter: ConversationStore = {
  ensureConversation(id, userId, title) {
    const existed = Boolean(store.getConversation(id));
    store.createConversation(id, userId, title);
    return { id, isNew: !existed };
  },
  addMessage(conversationId, userId, role, content, meta) {
    store.addMessage(conversationId, userId, role, content, meta as any);
  },
  getRecentMessages(conversationId, limit) {
    return store.getMessages(conversationId).slice(-limit).map((m) => ({ role: m.role, content: m.content }));
  },
  getCheckins(userId, limit) {
    return store.getCheckins(userId, limit);
  },
  getCrossChatContext(userId, currentId, max) {
    return store.getCrossChatContext(userId, currentId, max);
  },
};
