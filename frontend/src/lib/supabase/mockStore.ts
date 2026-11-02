// In-memory mock database & session manager for Netlify serverless & demo mode.
// Used when real Supabase credentials are not connected or when the user signs in as a guest, GitHub, or demo user.

export interface MockUser {
  id: string;
  email: string;
  is_guest?: boolean;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    github_username?: string;
    [key: string]: any;
  };
}

export interface MockConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MockMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface MockProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface MockCheckin {
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

// Default guest user
export const DEFAULT_GUEST_USER: MockUser = {
  id: "guest-user",
  email: "guest@mindcare.app",
  is_guest: true,
  user_metadata: { name: "Guest Explorer" },
};

// Default registered demo user
export const DEFAULT_DEMO_USER: MockUser = {
  id: "demo-user-mindcare",
  email: "friend@mindcare.app",
  is_guest: false,
  user_metadata: { name: "Friend" },
};

const INITIAL_CONVERSATION_ID = "c-welcome-1";

class MockDatabase {
  users: Map<string, MockUser> = new Map();
  profiles: Map<string, MockProfile> = new Map();
  conversations: Map<string, MockConversation> = new Map();
  messages: MockMessage[] = [];
  checkins: MockCheckin[] = [];

  constructor() {
    this.seed();
    this.loadFromStorage();
  }

  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const storedConvs = localStorage.getItem("mindcare_conversations") || localStorage.getItem("understory_conversations");
      if (storedConvs) {
        const parsed = JSON.parse(storedConvs);
        for (const item of parsed) this.conversations.set(item.id, item);
      }
      const storedMsgs = localStorage.getItem("mindcare_messages") || localStorage.getItem("understory_messages");
      if (storedMsgs) {
        this.messages = JSON.parse(storedMsgs);
      }
      const storedProfiles = localStorage.getItem("mindcare_profiles") || localStorage.getItem("understory_profiles");
      if (storedProfiles) {
        const parsed = JSON.parse(storedProfiles);
        for (const item of parsed) this.profiles.set(item.user_id || item.id, item);
      }
      const storedCheckins = localStorage.getItem("mindcare_checkins") || localStorage.getItem("understory_checkins");
      if (storedCheckins) {
        this.checkins = JSON.parse(storedCheckins);
      }
    } catch {}
  }

  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.setItem("mindcare_conversations", JSON.stringify(Array.from(this.conversations.values())));
      localStorage.setItem("mindcare_messages", JSON.stringify(this.messages));
      localStorage.setItem("mindcare_profiles", JSON.stringify(Array.from(this.profiles.values())));
      localStorage.setItem("mindcare_checkins", JSON.stringify(this.checkins));
    } catch {}
  }

  seed() {
    this.users.set(DEFAULT_DEMO_USER.id, DEFAULT_DEMO_USER);
    this.profiles.set(DEFAULT_DEMO_USER.id, {
      id: "p-1",
      user_id: DEFAULT_DEMO_USER.id,
      name: "Friend",
      email: DEFAULT_DEMO_USER.email,
      preferred_language: "en",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.conversations.set(INITIAL_CONVERSATION_ID, {
      id: INITIAL_CONVERSATION_ID,
      user_id: DEFAULT_DEMO_USER.id,
      title: "Welcome to MindCare",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.messages.push({
      id: "m-welcome-1",
      conversation_id: INITIAL_CONVERSATION_ID,
      user_id: DEFAULT_DEMO_USER.id,
      role: "assistant",
      content:
        "Hello and welcome. This is your quiet space to talk through whatever is present for you today. How is your mind feeling right now?",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    });

    // Seed a baseline check-in
    this.checkins.push({
      id: "chk-welcome-1",
      user_id: DEFAULT_DEMO_USER.id,
      mood: "good",
      stress_level: 2, // low stress (1-5 where 1=overload, 5=spacious)
      sleep_quality: 4,
      energy_level: 4,
      clarity_level: 4,
      score: 75,
      insight:
        "Your mind is in a balanced, grounded rhythm today. Restorative sleep and steady energy provide a supportive foundation. Take gentle pauses between activities to sustain this calm ease.",
      breakdown: {
        moodScore: 80,
        stressScore: 75,
        energyScore: 80,
        sleepScore: 80,
        clarityScore: 80,
      },
      notes: "Feeling grounded and ready for an unhurried day.",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    });
  }

  reset() {
    this.users.clear();
    this.profiles.clear();
    this.conversations.clear();
    this.messages = [];
    this.checkins = [];
    this.seed();
    this.saveToStorage();
  }
}

// Global singleton across server invocations
const globalForMock = global as unknown as { mockDb?: MockDatabase };
export const mockDb = globalForMock.mockDb || new MockDatabase();
if (process.env.NODE_ENV !== "production") globalForMock.mockDb = mockDb;

export function createQueryBuilder(table: string, currentUserId?: string) {
  let filteredData: any[] = [];
  let isSingle = false;

  // Initial table data snapshot
  if (table === "conversations") {
    filteredData = Array.from(mockDb.conversations.values());
  } else if (table === "messages") {
    filteredData = [...mockDb.messages];
  } else if (table === "profiles") {
    if (currentUserId && !mockDb.profiles.has(currentUserId)) {
      const u = mockDb.users.get(currentUserId);
      mockDb.profiles.set(currentUserId, {
        id: `p-${currentUserId}`,
        user_id: currentUserId,
        name: u?.user_metadata?.name || "Friend",
        email: u?.email || "",
        avatar_url: u?.user_metadata?.avatar_url,
        preferred_language: "en",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    filteredData = Array.from(mockDb.profiles.values());
  } else if (table === "wellbeing_checkins") {
    filteredData = [...mockDb.checkins];
  }

  const builder: any = {
    select(_columns?: string) {
      return builder;
    },
    eq(column: string, value: any) {
      filteredData = filteredData.filter((item) => item[column] === value);
      return builder;
    },
    order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
      filteredData.sort((a, b) => {
        if (a[column] < b[column]) return ascending ? -1 : 1;
        if (a[column] > b[column]) return ascending ? 1 : -1;
        return 0;
      });
      return builder;
    },
    limit(count: number) {
      filteredData = filteredData.slice(0, count);
      return builder;
    },
    single() {
      isSingle = true;
      return builder;
    },
    maybeSingle() {
      isSingle = true;
      return builder;
    },
    insert(rowOrRows: any) {
      const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      const inserted: any[] = [];

      for (const row of rows) {
        const id = row.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          ...row,
          id,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        };

        if (table === "conversations") {
          mockDb.conversations.set(id, record);
        } else if (table === "messages") {
          mockDb.messages.push(record);
        } else if (table === "profiles") {
          mockDb.profiles.set(row.user_id || id, record);
        } else if (table === "wellbeing_checkins") {
          mockDb.checkins.push(record);
        }
        inserted.push(record);
      }

      mockDb.saveToStorage();
      filteredData = inserted;
      return builder;
    },
    update(updates: any) {
      for (const item of filteredData) {
        Object.assign(item, updates, { updated_at: new Date().toISOString() });
        if (table === "conversations") {
          mockDb.conversations.set(item.id, item);
        } else if (table === "profiles") {
          mockDb.profiles.set(item.user_id || item.id, item);
        }
      }
      mockDb.saveToStorage();
      return builder;
    },
    delete() {
      for (const item of filteredData) {
        if (table === "conversations") {
          mockDb.conversations.delete(item.id);
          mockDb.messages = mockDb.messages.filter((m) => m.conversation_id !== item.id);
        } else if (table === "messages") {
          mockDb.messages = mockDb.messages.filter((m) => m.id !== item.id);
        }
      }
      mockDb.saveToStorage();
      return builder;
    },
    then(resolve: (res: { data: any; error: any }) => void) {
      let result = isSingle ? (filteredData[0] || null) : [...filteredData];

      // If querying conversations with messages relation, populate messages
      if (table === "conversations") {
        const attachMessages = (conv: any) => {
          if (!conv) return conv;
          const related = mockDb.messages
            .filter((m) => m.conversation_id === conv.id)
            .map((m) => ({ content: m.content, created_at: m.created_at }));
          return { ...conv, messages: related };
        };
        if (Array.isArray(result)) {
          result = result.map(attachMessages);
        } else if (result) {
          result = attachMessages(result);
        }
      }

      resolve({ data: result, error: null });
    },
  };

  return builder;
}
