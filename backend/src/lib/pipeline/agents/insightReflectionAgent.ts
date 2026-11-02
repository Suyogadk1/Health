import type { InsightReflectionInput, InsightReflectionOutput } from "../types";

const DISTRESS = new Set(["anxious", "sad", "overwhelmed", "numb", "lonely", "angry"]);

/**
 * Agent 7 - produces a short internal reflection for this turn and decides
 * whether a wellbeing check-in nudge is worthwhile (distress detected and the
 * user has no check-in history for the assistant to draw on).
 */
export async function insightReflectionAgent(input: InsightReflectionInput): Promise<InsightReflectionOutput> {
  const topics = input.matchedTopics.length ? ` Topics: ${input.matchedTopics.join(", ")}.` : "";
  const note =
    `Emotion=${input.emotionLabel} (intensity ${input.emotionIntensity}), risk=${input.riskLevel}.${topics} ` +
    `Reply length ${input.reply.trim().split(/\s+/).length} words.`;
  const suggestCheckin =
    DISTRESS.has(input.emotionLabel) && input.riskLevel !== "high" && !input.hasCheckinHistory;
  return { reflectionNote: note, suggestCheckin };
}
