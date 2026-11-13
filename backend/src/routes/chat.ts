import { Router, Response } from "express";
import { z } from "zod";
import { getMultiAIProvider } from "../lib/ai";
import { NemotronUltraProvider } from "../lib/ai/nemotronProvider";
import { checkRateLimit } from "../lib/utils/rateLimit";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { runChatPipeline } from "../lib/pipeline/orchestrator";
import { memoryStoreAdapter } from "../lib/pipeline/memoryStoreAdapter";

export const chatRouter = Router();

const bodySchema = z.object({
  language: z.enum(["en-US", "hi-IN", "ta-IN", "te-IN", "ne-NP"]).default("en-US"),
  voiceCall: z.boolean().default(false),
  conversationId: z.string().min(1),
  message: z.string().min(1).max(4000),
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
  // Verified user id from the session token, never from the request body.
  const userId = req.user!.id;

  const rate = checkRateLimit(userId);
  if (!rate.allowed) {
    return res.status(429).json({ error: "You're sending messages a little too quickly. Please wait a moment." });
  }

  try {
    const ai = getMultiAIProvider();
    const language = { "en-US": "English", "hi-IN": "Hindi", "ta-IN": "Tamil", "te-IN": "Telugu", "ne-NP": "Nepali" }[parsed.data.language];
    const key = process.env.NVIDIA_API_KEY;
    const llm = key && !key.includes("placeholder") ? new NemotronUltraProvider() : undefined;

    const r = await runChatPipeline(
      {
        store: memoryStoreAdapter,
        generate: (msgs, sys) => ai.generateWithDetails(msgs, sys + `\nRespond in ${language}, in its native script.` + (parsed.data.voiceCall ? "\nThis is an ongoing spoken call. Respond directly to the latest concern using the conversation history. Be concise, warm, and natural for speech, usually 2-4 sentences with one relevant follow-up question. Do not end the conversation or repeat your introduction. Preserve all safety requirements." : "")),
        classifier: process.env.HYBRID_RISK_CLASSIFIER === "false" ? undefined : llm, // Agent A, LLM tier
        reviewer: llm, // Agent B
      },
      { user: { id: userId }, rawConversationId: parsed.data.conversationId, rawMessage: parsed.data.message }
    );

    return res.json({
      reply: r.reply,
      risk: r.isDangerous ? "high" : r.risk,
      safetyCoverage: r.safetyCoverage,
      riskSource: r.riskSource,
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
    console.error("[Backend Chat Route] Pipeline failed:", err);
    return res.status(500).json({
      error: "I'm having a quiet moment right now. Please try reaching out again in a few seconds.",
    });
  }
});
