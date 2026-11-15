import { SYSTEM_PROMPT, MAX_RESPONSE_WORDS } from "../../ai/systemPrompt";
import { assessRisk } from "../../safety/riskAssessment";
import { HIGH_RISK_RESPONSE, SUPPORT_FOOTER } from "../../safety/safetyResponse";
import { reviewAndFinalize } from "../../safety/safetyOrchestrator";
import type { ResponseComposerInput, ResponseComposerOutput } from "../types";

function truncateToWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  return words.length <= maxWords ? text.trim() : words.slice(0, maxWords).join(" ") + "…";
}

/**
 * Agent 6 - builds the system prompt from all upstream context, calls the
 * provider chain, then runs the post-generation safety review (Agent B),
 * word-limit and output-risk checks before anything is released.
 */
export async function responseComposerAgent(input: ResponseComposerInput): Promise<ResponseComposerOutput> {
  const sections: string[] = ["base"];
  let prompt = SYSTEM_PROMPT;

  if (input.checkinContextText) { prompt += `\n\n${input.checkinContextText}`; sections.push("checkin-history"); }
  if (input.crossChatContextText) { prompt += `\n\n${input.crossChatContextText}`; sections.push("cross-chat-memory"); }
  if (input.graphContextText) {
    prompt += `\n\nRelevant knowledge-graph context (use to ground suggestions; do not quote verbatim):\n${input.graphContextText}`;
    sections.push("knowledge-graph");
  }
  if (input.riskLevel === "moderate") {
    prompt += "\n\nThe user may be experiencing significant distress. Prioritize validation, avoid minimizing, and gently encourage reaching out to a trusted person or professional.";
    sections.push("moderate-risk-guidance");
  }
  const sustained = (input.riskSignals ?? []).some((s) => s === "sustained-distress" || s === "post-crisis-followup");
  if (sustained) {
    prompt += "\n\nThis user has shown distress across several messages. Gently and directly ask whether they have had thoughts of harming themselves or not wanting to be here, and let them know support is available. Do not lecture.";
    sections.push("sustained-distress-guidance");
  }
  if (input.emotionLabel !== "neutral") {
    prompt += `\n\nDetected dominant emotion in the latest message: ${input.emotionLabel}. Match your tone accordingly.`;
    sections.push("emotion-tone");
  }

  const result = await input.generate(input.chatHistory, prompt);
  const decision = await reviewAndFinalize(input.userMessage, result.reply, { reviewerProvider: input.reviewer });

  let reply = decision.overridden ? decision.finalReply : result.reply;
  reply = truncateToWords(reply, MAX_RESPONSE_WORDS);
  const isDangerous = assessRisk(reply).level === "high";
  if (isDangerous) reply = HIGH_RISK_RESPONSE;
  else if (input.riskLevel === "moderate" || sustained) reply = `${reply}\n\n${SUPPORT_FOOTER}`;

  return {
    reply, provider: result.provider, model: result.model, attempts: result.attempts,
    draftReply: result.reply, reviewerTrace: decision.reviewerTrace, reviewDecision: decision,
    systemPromptSections: sections,
    agentALevel: decision.agentALevel, agentBLevel: decision.agentBLevel, overridden: decision.overridden, isDangerous,
  };
}
