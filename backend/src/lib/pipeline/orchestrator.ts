import { intakeRouterAgent } from "./agents/intakeRouterAgent";
import { emotionAgent } from "./agents/emotionAgent";
import { memoryAgent } from "./agents/memoryAgent";
import { graphRetrievalAgent } from "./agents/graphRetrievalAgent";
import { safetyAgent } from "./agents/safetyAgent";
import { responseComposerAgent } from "./agents/responseComposerAgent";
import { insightReflectionAgent } from "./agents/insightReflectionAgent";
import type { ChatPipelineResult, PipelineDeps, PipelineStageTimings, PipelineUser, StageName } from "./types";

/**
 * Runs the 7 agents in order, threading each agent's typed output into the
 * next agent's typed input. If the Safety agent short-circuits, the Response
 * Composer is skipped (no generation model is called) but Insight still runs.
 */
export async function runChatPipeline(
  deps: PipelineDeps,
  params: { user: PipelineUser; rawConversationId: string; rawMessage: string }
): Promise<ChatPipelineResult> {
  const timings = {} as PipelineStageTimings;
  const timed = async <T>(name: StageName, fn: () => Promise<T>): Promise<T> => {
    const t0 = performance.now();
    try { return await fn(); } finally { timings[name] = Math.round(performance.now() - t0); }
  };

  const intake = await timed("intake", () =>
    intakeRouterAgent({ store: deps.store, user: params.user, rawConversationId: params.rawConversationId, rawMessage: params.rawMessage }));

  // Earlier user turns (excluding the one just persisted) feed multi-turn risk tracking.
  const priorUserMessages = deps.store.getRecentMessages(intake.conversationId, 12)
    .filter((m) => m.role === "user").map((m) => m.content).slice(0, -1);

  const emotion = await timed("emotion", () =>
    emotionAgent({ message: intake.message, classifier: deps.classifier, previousUserMessages: priorUserMessages }));

  const memory = await timed("memory", () =>
    memoryAgent({ store: deps.store, conversationId: intake.conversationId, userId: params.user.id }));

  const graph = await timed("graph", () =>
    graphRetrievalAgent({ message: intake.message, emotionLabel: emotion.emotionLabel }));

  const gate = await timed("safety", () => safetyAgent({ risk: emotion.risk }));

  let reply: string, provider: string, model: string | undefined, attempts: string[] | undefined;
  let agentALevel = emotion.risk.level, agentBLevel = emotion.risk.level, overridden = false;
  let sections: string[] = [], isDangerous = false;
  let draftReply: string | undefined, reviewerTrace: ChatPipelineResult["reviewerTrace"];

  if (gate.shortCircuit) {
    timings.compose = 0;
    reply = gate.shortCircuitReply!; provider = "Safety Guardrail";
  } else {
    const c = await timed("compose", () => responseComposerAgent({
      userMessage: intake.message, riskLevel: gate.level, riskSignals: emotion.risk.matchedSignals, chatHistory: memory.chatHistory,
      checkinContextText: memory.checkinContextText, crossChatContextText: memory.crossChatContextText, graphContextText: graph.graphContextText,
      emotionLabel: emotion.emotionLabel, generate: deps.generate, reviewer: deps.reviewer,
    }));
    ({ reply, provider, model, attempts, draftReply, reviewerTrace } = c);
    agentALevel = c.agentALevel; agentBLevel = c.agentBLevel; overridden = c.overridden; sections = c.systemPromptSections; isDangerous = c.isDangerous;
  }

  const reflection = await timed("insight", () => insightReflectionAgent({
    userMessage: intake.message, reply, emotionLabel: emotion.emotionLabel, emotionIntensity: emotion.emotionIntensity,
    riskLevel: gate.level, matchedTopics: graph.matchedTopics, hasCheckinHistory: memory.hasCheckinHistory,
  }));

  // Persist assistant turn (HTTP-independent, so the pipeline owns the full turn).
  deps.store.addMessage(intake.conversationId, params.user.id, "assistant", reply, {
    provider, attempts, agentALevel, agentBLevel, overridden,
  });

  return {
    classifierTrace: emotion.classifierTrace, draftReply, reviewerTrace,
    conversationId: intake.conversationId, reply, risk: gate.level, riskSource: emotion.riskSource, safetyCoverage: emotion.safetyCoverage,
    emotionLabel: emotion.emotionLabel, provider, model, attempts, agentALevel, agentBLevel, overridden,
    graphTopics: graph.matchedTopics, contextSections: sections, isDangerous,
    interconnectedChats: memory.crossChat.map((c) => ({ id: c.id, title: c.title, relativeTime: c.relativeTime })),
    matchedSignals: emotion.risk.matchedSignals, reflection, stageTimings: timings,
  };
}
