import type { CheckinRow } from "../wellbeing/checkinContext";
import type { AIProvider, ChatMessage, GenerationResult } from "../ai/provider";
import type { RiskAssessment, RiskLevel } from "../safety/safetyTypes";

/**
 * Typed contracts for the 7-agent chat pipeline:
 *
 *   Intake/Router -> Emotion -> Memory -> Graph Retrieval -> Safety
 *     -> Response Composer -> Insight/Reflection
 *
 * Every agent is `(input: XInput) => Promise<XOutput>`. Each input holds only
 * what that agent needs; the orchestrator (orchestrator.ts) owns the running
 * context and hands each agent its typed slice. That slicing is the handoff
 * contract between agents.
 */

export interface PipelineUser { id: string; email?: string | null }

export interface CrossChatItem {
  id: string;
  title: string;
  relativeTime: string;
  userSnippets: string[];
  assistantSummary?: string;
}

/** Persistence boundary. Backend adapter: memoryStoreAdapter.ts (wraps lib/store). */
export interface ConversationStore {
  ensureConversation(id: string, userId: string, title: string): { id: string; isNew: boolean };
  addMessage(conversationId: string, userId: string, role: "user" | "assistant", content: string, meta?: Record<string, unknown>): void;
  getRecentMessages(conversationId: string, limit: number): ChatMessage[];
  getCheckins(userId: string, limit: number): CheckinRow[];
  getCrossChatContext(userId: string, currentConversationId: string, max: number): CrossChatItem[];
}

/** External dependencies, injected so the whole pipeline is testable offline. */
export interface PipelineDeps {
  store: ConversationStore;
  /** Generation chain (production: MultiAIProvider.generateWithDetails). */
  generate: (messages: ChatMessage[], systemPrompt: string) => Promise<GenerationResult>;
  /** Optional LLM used for the hybrid input classifier (Emotion agent). */
  classifier?: AIProvider;
  /** Optional LLM used as Agent B draft-reply reviewer (Composer). */
  reviewer?: AIProvider;
}

// 1. Intake / Router
export interface IntakeRouterInput {
  store: ConversationStore;
  user: PipelineUser;
  rawConversationId: string;
  rawMessage: string;
}
export interface IntakeRouterOutput {
  conversationId: string;
  message: string;
  isNewConversation: boolean;
}

// 2. Emotion
export type EmotionLabel = "anxious" | "sad" | "angry" | "overwhelmed" | "numb" | "lonely" | "hopeful" | "neutral";
export interface EmotionInput { message: string; classifier?: AIProvider; previousUserMessages?: string[] }
export interface EmotionOutput {
  risk: RiskAssessment;
  riskSource: string;
  /** "full" = LLM tier was available for this message; "limited" = rules only (no/failed classifier). */
  safetyCoverage: "full" | "limited";
  emotionLabel: EmotionLabel;
  emotionIntensity: number; // 0..1
}

// 3. Memory
export interface MemoryInput { store: ConversationStore; conversationId: string; userId: string }
export interface MemoryOutput {
  chatHistory: ChatMessage[];
  checkinContextText: string;
  hasCheckinHistory: boolean;
  crossChatContextText: string;
  crossChat: CrossChatItem[];
}

// 4. Graph Retrieval
export interface GraphRetrievalInput { message: string; emotionLabel: EmotionLabel }
export interface GraphRetrievalOutput { matchedTopics: string[]; graphContextText: string }

// 5. Safety (pre-generation gate)
export interface SafetyGateInput { risk: RiskAssessment }
export interface SafetyGateOutput {
  level: RiskLevel;
  shortCircuit: boolean;
  shortCircuitReply?: string;
}

// 6. Response Composer
export interface ResponseComposerInput {
  userMessage: string;
  riskLevel: RiskLevel;
  riskSignals?: string[];
  chatHistory: ChatMessage[];
  checkinContextText: string;
  crossChatContextText: string;
  graphContextText: string;
  emotionLabel: EmotionLabel;
  generate: PipelineDeps["generate"];
  reviewer?: AIProvider;
}
export interface ResponseComposerOutput {
  reply: string;
  provider: string;
  model?: string;
  attempts?: string[];
  systemPromptSections: string[]; // which context blocks were injected (for audit/tests)
  agentALevel: RiskLevel;
  agentBLevel: RiskLevel;
  overridden: boolean;
  isDangerous: boolean; // output-side risk check fired
}

// 7. Insight / Reflection
export interface InsightReflectionInput {
  userMessage: string;
  reply: string;
  emotionLabel: EmotionLabel;
  emotionIntensity: number;
  riskLevel: RiskLevel;
  matchedTopics: string[];
  hasCheckinHistory: boolean;
}
export interface InsightReflectionOutput {
  reflectionNote: string; // internal, never shown to the user
  suggestCheckin: boolean;
}

export type StageName = "intake" | "emotion" | "memory" | "graph" | "safety" | "compose" | "insight";
export type PipelineStageTimings = Record<StageName, number>;

export interface ChatPipelineResult {
  conversationId: string;
  reply: string;
  risk: RiskLevel;
  riskSource: string;
  safetyCoverage: "full" | "limited";
  emotionLabel: EmotionLabel;
  provider: string;
  model?: string;
  attempts?: string[];
  agentALevel: RiskLevel;
  agentBLevel: RiskLevel;
  overridden: boolean;
  graphTopics: string[];
  contextSections: string[];
  isDangerous: boolean;
  interconnectedChats: { id: string; title: string; relativeTime: string }[];
  matchedSignals: string[];
  reflection: InsightReflectionOutput;
  stageTimings: PipelineStageTimings;
}
