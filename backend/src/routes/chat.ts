import { Router, Response } from "express";
import { z } from "zod";
import { getMultiAIProvider } from "../lib/ai";
import { NemotronUltraProvider } from "../lib/ai/nemotronProvider";
import { checkRateLimit } from "../lib/utils/rateLimit";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { runChatPipeline } from "../lib/pipeline/orchestrator";
import { memoryStoreAdapter } from "../lib/pipeline/memoryStoreAdapter";
import { evaluationEnabled, recordingSession } from "../lib/pipeline/evaluationRecorder";
import type { GenerationResult } from "../lib/ai/provider";
import { failureCategory } from "../lib/ai/boundedCall";

export const chatRouter = Router();

const bodySchema = z.object({
  language: z.enum(["en-US", "hi-IN", "ta-IN", "te-IN", "ne-NP"]).default("en-US"),
  voiceCall: z.boolean().default(false),
  conversationId: z.string().min(1),
  message: z.string().min(1).max(4000),
  participantCode: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  evaluationConsent: z.boolean().default(false),
});

/**
 * HTTP layer only (auth, validation, rate limit). The conversational logic
 * is the 7-agent pipeline in lib/pipeline:
 *   Intake/Router -> Emotion -> Memory -> Graph Retrieval -> Safety
 *   -> Response Composer -> Insight/Reflection
 */
chatRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request payload", details: parsed.error.issues });
  }
  // Evaluation codes isolate local research context; they are not authentication credentials.
  const userId = evaluationEnabled() && parsed.data.participantCode ? "evaluation-" + parsed.data.participantCode : req.user!.id;
  const effectiveConversationId = evaluationEnabled() ? userId + ":" + parsed.data.conversationId : parsed.data.conversationId;

  const rate = checkRateLimit(userId);
  if (!rate.allowed) {
    return res.status(429).json({ error: "You're sending messages a little too quickly. Please wait a moment." });
  }

  let recording: ReturnType<typeof recordingSession>;
  let recordedDraft: GenerationResult | undefined;
  const started = performance.now();
  if (evaluationEnabled() && (!parsed.data.evaluationConsent || !parsed.data.participantCode)) {
    return res.status(400).json({ error: "Enter a participant code and confirm consent before sending an evaluation message." });
  }
  try {
    if (evaluationEnabled()) {
      recording = recordingSession(parsed.data.participantCode!, parsed.data.conversationId);
      const prior = memoryStoreAdapter.getRecentMessages(effectiveConversationId, 10000);
      const disk = recording?.previousTranscript() ?? [];
      if (!prior.length && disk.length) {
        memoryStoreAdapter.ensureConversation(effectiveConversationId, userId, "Evaluation session");
        for (const m of disk) memoryStoreAdapter.addMessage(effectiveConversationId, userId, m.role, m.content);
      }
      recording?.append({ event: "request", language: parsed.data.language, message: parsed.data.message, consentConfirmed: true });
    }
    const ai = getMultiAIProvider();
    const language = { "en-US": "English", "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu", "ne-NP": "Nepali" }[parsed.data.language];
    const key = process.env.NVIDIA_API_KEY;
    const llm = key && !key.includes("placeholder") ? new NemotronUltraProvider() : undefined;

    const r = await runChatPipeline(
      {
        store: memoryStoreAdapter,
        generate: async (msgs, sys) => {
          const result = await ai.generateWithDetails(msgs, sys + `\nRespond in ${language}, in its native script.` + (parsed.data.voiceCall ? "\nThis is an ongoing spoken call. Respond directly to the latest concern using the conversation history. Be concise, warm, and natural for speech, usually 2-4 sentences with one relevant follow-up question. Do not end the conversation or repeat your introduction. Preserve all safety requirements." : ""));
          recordedDraft = result;
          return result;
        },
        classifier: process.env.HYBRID_RISK_CLASSIFIER === "false" ? undefined : llm, // Agent A, LLM tier
        reviewer: llm, // Agent B
      },
      { user: { id: userId }, rawConversationId: effectiveConversationId, rawMessage: parsed.data.message }
    );

    const finalLatencyMs = Math.round(performance.now() - started);
    recording?.append({ event: "response", language: parsed.data.language, finalLatencyMs, result: r,
      generation: recordedDraft, transcript: memoryStoreAdapter.getRecentMessages(effectiveConversationId, 10000) });
    return res.json({
      reply: r.reply,
      risk: r.isDangerous ? "high" : r.risk,
      safetyCoverage: r.safetyCoverage,
      riskSource: r.riskSource,
      classifierTrace: r.classifierTrace,
      reviewerTrace: r.reviewerTrace,
      finalLatencyMs,
      recordingId: recording?.id,
      configurationHash: recording?.configurationHash,
      isDangerous: r.isDangerous,
      matchedSignals: r.matchedSignals,
      agentALevel: r.agentALevel,
      agentBLevel: r.agentBLevel,
      overridden: r.overridden,
      provider: r.provider,
      model: r.model,
      attempts: r.attempts,
      interconnectedChats: r.interconnectedChats,
      // additive pipeline metadata
      emotion: r.emotionLabel,
      graphTopics: r.graphTopics,
      contextSections: r.contextSections,
      suggestCheckin: r.reflection.suggestCheckin,
      stageTimings: r.stageTimings,
    });
  } catch (err: any) {
    try { recording?.append({ event: "request_failed", errorCategory: failureCategory(err), elapsedMs: Math.round(performance.now() - started) }); } catch { /* The response must not claim that recording succeeded. */ }
    console.error("[Backend Chat Route] Pipeline failed:", failureCategory(err));
    return res.status(500).json({
      error: evaluationEnabled() ? "Evaluation request failed. Check the local recording and configuration before continuing." : "I'm having a quiet moment right now. Please try reaching out again in a few seconds.",
    });
  }
});
