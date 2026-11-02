export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  provider?: string;
  attempts?: string[];
  agentALevel?: string;
  agentBLevel?: string;
  overridden?: boolean;
}

export interface CrossChatMemory {
  id: string;
  title: string;
  relativeTime: string;
  userSnippets: string[];
  assistantSummary?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  preferred_language?: string;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  mood: string;
  stress_level?: number;
  sleep_quality?: number;
  energy_level?: number;
  clarity_level?: number;
  score?: number;
  insight?: string;
  breakdown?: any;
  notes?: string;
  created_at: string;
}

class MemoryStore {
  conversations: Map<string, Conversation> = new Map();
  messages: Message[] = [];
  profiles: Map<string, Profile> = new Map();
  checkins: Checkin[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    const defaultUserId = "friend-user";

    this.profiles.set(defaultUserId, {
      id: "p-1",
      user_id: defaultUserId,
      name: "Friend",
      email: "friend@mindcare.app",
      preferred_language: "en",
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 1. Welcome conversation
    const cWelcome = "c-welcome-1";
    this.conversations.set(cWelcome, {
      id: cWelcome,
      user_id: defaultUserId,
      title: "Welcome to MindCare",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    });
    this.messages.push({
      id: "m-welcome-1",
      conversation_id: cWelcome,
      user_id: defaultUserId,
      role: "assistant",
      content:
        "Hello and welcome. This is your quiet space to talk through whatever is present for you today. How is your mind feeling right now?",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    });

    // 2. Previous chat: Navigating Overwhelm & Work Stress
    const cStress = "c-stress-1";
    this.conversations.set(cStress, {
      id: cStress,
      user_id: defaultUserId,
      title: "Navigating work overwhelm",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    });
    this.messages.push(
      {
        id: "m-stress-1",
        conversation_id: cStress,
        user_id: defaultUserId,
        role: "user",
        content: "I have been feeling quite overwhelmed with deadlines lately and finding it hard to switch off.",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "m-stress-2",
        conversation_id: cStress,
        user_id: defaultUserId,
        role: "assistant",
        content:
          "It is completely understandable to feel overwhelmed when everything demands your attention at once. Remember that taking a pause is not falling behind—it is how we sustain ourselves. Have you tried taking a gentle 3-breath pause before switching tasks?",
        created_at: new Date(Date.now() - 86400000 + 60000).toISOString(),
      }
    );

    // 3. Previous chat: Evening Calm & Sleep
    const cSleep = "c-sleep-1";
    this.conversations.set(cSleep, {
      id: cSleep,
      user_id: defaultUserId,
      title: "Evening calm and sleep",
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    });
    this.messages.push(
      {
        id: "m-sleep-1",
        conversation_id: cSleep,
        user_id: defaultUserId,
        role: "user",
        content: "My thoughts race when I lie down to sleep. Looking for ways to soften that.",
        created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      },
      {
        id: "m-sleep-2",
        conversation_id: cSleep,
        user_id: defaultUserId,
        role: "assistant",
        content:
          "Racing thoughts often arise when the mind finally gets quiet enough to be heard. Try gently placing a hand on your stomach and feeling the rise and fall of each breath without trying to change anything.",
        created_at: new Date(Date.now() - 3600000 * 6 + 60000).toISOString(),
      }
    );
  }

  getConversations(userId: string = "friend-user"): (Conversation & { messages?: { content: string; created_at: string }[] })[] {
    const list = Array.from(this.conversations.values())
      .filter((c) => !userId || c.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return list.map((conv) => {
      const related = this.messages
        .filter((m) => m.conversation_id === conv.id)
        .map((m) => ({ content: m.content, created_at: m.created_at }));
      return { ...conv, messages: related };
    });
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  createConversation(id: string, userId: string, title: string): Conversation {
    const existing = this.conversations.get(id);
    if (existing) return existing;

    const record: Conversation = {
      id,
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.conversations.set(id, record);
    return record;
  }

  deleteConversation(id: string): boolean {
    const existed = this.conversations.delete(id);
    this.messages = this.messages.filter((m) => m.conversation_id !== id);
    return existed;
  }

  getCrossChatContext(userId: string = "friend-user", currentConversationId?: string, maxConvos: number = 3): CrossChatMemory[] {
    const list = Array.from(this.conversations.values())
      .filter((c) => (!userId || c.user_id === userId) && c.id !== currentConversationId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, maxConvos);

    return list.map((c) => {
      const convoMessages = this.messages
        .filter((m) => m.conversation_id === c.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const userMsgs = convoMessages
        .filter((m) => m.role === "user")
        .map((m) => m.content.slice(0, 160));

      const lastAssistant = convoMessages
        .filter((m) => m.role === "assistant")
        .slice(-1)[0]?.content.slice(0, 160);

      const diffHours = Math.round((Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60));
      const relativeTime =
        diffHours <= 1
          ? "Just recently"
          : diffHours < 24
          ? `${diffHours} hours ago`
          : `${Math.max(1, Math.round(diffHours / 24))} days ago`;

      return {
        id: c.id,
        title: c.title,
        relativeTime,
        userSnippets: userMsgs.length > 0 ? userMsgs.slice(-2) : ["General mindful check-in"],
        assistantSummary: lastAssistant,
      };
    });
  }

  getMessages(conversationId: string): Message[] {
    return this.messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  addMessage(
    conversationId: string,
    userId: string,
    role: "user" | "assistant",
    content: string,
    meta?: {
      provider?: string;
      attempts?: string[];
      agentALevel?: string;
      agentBLevel?: string;
      overridden?: boolean;
    }
  ): Message {
    const msg: Message = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: conversationId,
      user_id: userId,
      role,
      content,
      created_at: new Date().toISOString(),
      provider: meta?.provider,
      attempts: meta?.attempts,
      agentALevel: meta?.agentALevel,
      agentBLevel: meta?.agentBLevel,
      overridden: meta?.overridden,
    };
    this.messages.push(msg);

    // Update conversation timestamp
    const convo = this.conversations.get(conversationId);
    if (convo) {
      convo.updated_at = new Date().toISOString();
      this.conversations.set(conversationId, convo);
    }

    return msg;
  }

  getProfile(userId: string): Profile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        id: `p-${userId}`,
        user_id: userId,
        name: "Friend",
        email: "friend@mindcare.app",
        preferred_language: "en",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.profiles.set(userId, profile);
    }
    return profile;
  }

  updateProfile(userId: string, data: Partial<Profile>): Profile {
    const current = this.getProfile(userId);
    const updated = { ...current, ...data, updated_at: new Date().toISOString() };
    this.profiles.set(userId, updated);
    return updated;
  }

  addCheckin(data: Omit<Checkin, "id" | "created_at">): Checkin {
    const checkin: Checkin = {
      ...data,
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    this.checkins.unshift(checkin);
    return checkin;
  }

  getCheckins(userId: string, limit: number = 10): Checkin[] {
    return this.checkins
      .filter((c) => c.user_id === userId)
      .slice(0, limit);
  }

  getLatestCheckin(userId: string): Checkin | undefined {
    return this.checkins.find((c) => c.user_id === userId);
  }
}

export const store = new MemoryStore();
