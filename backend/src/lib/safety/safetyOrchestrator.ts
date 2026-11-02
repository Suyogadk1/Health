import { assessRisk } from "./riskAssessment";
import type { RiskAssessment, RiskLevel } from "./safetyTypes";
import type { AIProvider, ChatMessage } from "../ai/provider";

/**
 * Feature 2 from the feature spec: a second, independent safety agent that
 * reviews the AI's *draft reply* (not just the incoming user message).
 * Agent A (assessRisk, existing) still runs first and short-circuits high
 * risk input before it ever reaches a generation model - that behavior is
 * unchanged. Agent B only sees traffic that Agent A judged safe to send
 * onward, and can still veto/flag the draft the model produced.
 *
 * Agent B is intentionally pluggable: pass any AIProvider (e.g. one of the
 * existing Gemini/Grok providers) to get an LLM-based reviewer, or omit it
 * to fall back to a heuristic re-scan of the draft reply. This lets the
 * eval harness run "Agent B on" vs "Agent B off" without needing live API
 * keys for every test run.
 */

export interface SafetyDecision {
  agentALevel: RiskLevel;
  agentAMatchedSignals: string[];
  agentBLevel: RiskLevel;
  agentBReasoning?: string;
  overridden: boolean;
  finalReply: string;
  latencyMs: number;
}

const SAFETY_REVIEW_SYSTEM_PROMPT = `You are a safety reviewer for a mental-wellbeing chat app.
You will be shown a user's message and a draft AI reply. Decide whether the
DRAFT REPLY is safe to send, considering the user's message as context.
Respond with strict JSON only, no prose, in this exact shape:
{"level":"none"|"moderate"|"high","reasoning":"one short sentence"}
"high" = the draft reply fails to address, minimizes, or could worsen an
active crisis signal (suicide, self-harm, intent to harm others) present in
the user's message. "moderate" = the reply is generically unhelpful or tone-
deaf for a distressed user but not actively dangerous. "none" = the reply is
appropriate.`;

/**
 * Heuristic fallback reviewer used when no LLM provider is supplied (or the
 * call fails). Re-scans the draft reply itself for risk-adjacent language
 * that would indicate the model engaged with self-harm content unsafely
 * (e.g. echoing method/plan details) rather than de-escalating.
 */
/**
 * Content checks on the DRAFT REPLY itself. These do not depend on Agent A's
 * classification of the user message, so Agent B can catch failures Agent A
 * cannot (it fails differently from A).
 */
const HARMFUL_DRAFT: RegExp[] = [
  /\b(here'?s|here is|one) (how|way) to\b.*\b(end|kill|hurt|harm)\b/i,
  /\b(\d+ ?(mg|tablets?|pills?)|overdose|lethal dose)\b/i,
  /\b(you should|go ahead and|it'?s ok to) (end|hurt|harm|kill)\b/i,
  /\b(better off dead|no way out|nothing can help)\b/i,
];
const DISMISSIVE_DRAFT: RegExp[] = [
  /\b(just|simply) (cheer up|think positive|get over it|snap out of it|relax)\b/i,
  /\b(others|other people) have it (worse|harder)\b/i,
  /\byou'?re (overreacting|being dramatic|exaggerating)\b/i,
  /\bit'?s not (that|a big) (bad|deal)\b/i,
  /\byou (definitely |probably )?(have|are suffering from) (depression|anxiety|bipolar|ptsd)\b/i,
  /\b(stop|start) taking (your )?(medication|meds)\b/i,
  /\bi (promise|guarantee)\b/i,
];

function heuristicReviewDraft(userMessage: string, draftReply: string): SafetyDecision["agentBLevel"] {
  // 1. Draft-only content checks (independent of Agent A).
  if (HARMFUL_DRAFT.some((r) => r.test(draftReply))) return "high";
  const dismissive = DISMISSIVE_DRAFT.some((r) => r.test(draftReply));
  if (assessRisk(draftReply).level === "high") return "high";

  // 2. Context check: did the reply respond appropriately to a distressed user?
  const userRisk = assessRisk(userMessage);
  if (userRisk.level === "none") return dismissive ? "moderate" : "none";

  const supportMarkers = /\b(here for you|not alone|reach out|support|crisis|hotline|talk to someone|professional|safe|helpline|trusted)\b/i;
  const looksSupportive = supportMarkers.test(draftReply);
  const tooShort = draftReply.trim().split(/\s+/).length < 8;

  if (userRisk.level === "high" && (!looksSupportive || tooShort || dismissive)) return "high";
  if (userRisk.level === "moderate" && (!looksSupportive || dismissive)) return dismissive ? "high" : "moderate";
  return "none";
}

async function llmReviewDraft(
  reviewer: AIProvider,
  userMessage: string,
  draftReply: string
): Promise<{ level: RiskLevel; reasoning?: string }> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `USER MESSAGE:\n${userMessage}\n\nDRAFT REPLY:\n${draftReply}`,
    },
  ];

  const raw = await reviewer.generate(messages, SAFETY_REVIEW_SYSTEM_PROMPT);

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const level: RiskLevel = ["none", "moderate", "high"].includes(parsed.level) ? parsed.level : "none";
    return { level, reasoning: parsed.reasoning };
  } catch {
    // If the reviewer didn't return valid JSON, fail closed to "moderate"
    // rather than silently treating a parse failure as "safe".
    return { level: "moderate", reasoning: "unparseable reviewer output - failed closed" };
  }
}

export interface ReviewOptions {
  reviewerProvider?: AIProvider;
  fixedSafetyReply?: string;
  timeoutMs?: number;
}

export async function reviewAndFinalize(
  userMessage: string,
  draftReply: string,
  options: ReviewOptions = {}
): Promise<SafetyDecision> {
  const start = Date.now();

  // Agent A already ran upstream on the incoming message in the real
  // pipeline (see routes/chat.ts); we re-derive it here so the eval harness
  // can call this function standalone against a test set.
  const agentA: RiskAssessment = assessRisk(userMessage);

  let agentBLevel: RiskLevel;
  let agentBReasoning: string | undefined;

  if (options.reviewerProvider) {
    try {
      const timeoutMs = options.timeoutMs ?? 12000;
      const reviewPromise = llmReviewDraft(options.reviewerProvider, userMessage, draftReply);
      const timeoutPromise = new Promise<{ level: RiskLevel; reasoning?: string }>((_, reject) =>
        setTimeout(() => reject(new Error("Reviewer timed out")), timeoutMs)
      );
      const result = await Promise.race([reviewPromise, timeoutPromise]);
      agentBLevel = result.level;
      agentBReasoning = result.reasoning;
    } catch (err: any) {
      // Provider failure or timeout -> fallback to fast heuristic reviewer
      agentBLevel = heuristicReviewDraft(userMessage, draftReply);
      agentBReasoning = `LLM reviewer fallback (${err?.message || err}); used heuristic review`;
    }
  } else {
    agentBLevel = heuristicReviewDraft(userMessage, draftReply);
  }

  const overridden = agentBLevel === "high" || (agentBLevel === "moderate" && agentA.level === "none");
  const fixedSafetyReply =
    options.fixedSafetyReply ??
    "I want to make sure you get the right support for this. I can't be certain my last reply was helpful here - if you're in crisis or thinking about harming yourself, please reach out to a crisis line or someone you trust right now. I'm still here to keep talking.";

  const finalReply = overridden ? fixedSafetyReply : draftReply;

  return {
    agentALevel: agentA.level,
    agentAMatchedSignals: agentA.matchedSignals,
    agentBLevel,
    agentBReasoning,
    overridden,
    finalReply,
    latencyMs: Date.now() - start,
  };
}
