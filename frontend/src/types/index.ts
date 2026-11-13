export type Mood = "great" | "good" | "okay" | "low" | "stressed";

export interface Profile {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  preferredLanguage: string;
  wellbeingGoals: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  risk?: RiskLevel;
  isDangerous?: boolean;
  provider?: string;
  attempts?: string[];
  agentALevel?: RiskLevel;
  agentBLevel?: RiskLevel;
  overridden?: boolean;
  evaluation?: {
    model?: string;
    riskSource?: string;
    safetyCoverage?: string;
    clientRoundTripMs: number;
    stageTimings?: Record<string, number>;
  };
}

export interface WellbeingCheckin {
  id: string;
  userId: string;
  mood: Mood;
  stressLevel?: number | null;
  sleepQuality?: number | null;
  energyLevel?: number | null;
  clarityLevel?: number | null;
  score?: number | null;
  insight?: string | null;
  breakdown?: {
    moodScore: number;
    stressScore: number;
    energyScore: number;
    sleepScore: number;
    clarityScore: number;
  } | null;
  notes?: string | null;
  createdAt: string;
}

export type RiskLevel = "none" | "moderate" | "high";

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "ended";
