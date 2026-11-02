import { assessRiskHybrid } from "../../safety/riskAssessment";
import { assessConversationRisk } from "../../safety/conversationRisk";
import type { EmotionInput, EmotionLabel, EmotionOutput } from "../types";

const LEXICON: Record<Exclude<EmotionLabel, "neutral">, RegExp[]> = {
  anxious: [/anxious|anxiety|panic|nervous|on edge|worried|racing thoughts|scared/i],
  overwhelmed: [/overwhelm|too much|swamped|burn(ed|t)? out|drained|can'?t cope/i],
  sad: [/\bsad\b|depress|down\b|crying|cry\b|grief|grieving|heartbroken|miserable|hopeless/i],
  angry: [/angry|furious|irritat|annoyed|frustrat|resent|snapp/i],
  numb: [/\bnumb\b|empty|nothing matters|don'?t feel anything|blank/i],
  lonely: [/lonely|alone|isolated|no one (cares|notices)|disconnected/i],
  hopeful: [/hopeful|grateful|proud|better today|excited|looking forward|relieved/i],
};

/** Agent 2 - risk screening (regex, optionally + LLM classifier) and a coarse emotion label. */
export async function emotionAgent(input: EmotionInput): Promise<EmotionOutput> {
  const hybrid = await assessRiskHybrid(input.message, input.classifier);
  // Multi-turn tracking: risk can build across messages. Take the MORE severe of the two.
  const conv = assessConversationRisk(input.previousUserMessages ?? [], input.message);
  const rank = { none: 0, moderate: 1, high: 2 } as const;
  const risk = rank[conv.level] > rank[hybrid.level]
    ? { level: conv.level, matchedSignals: Array.from(new Set([...hybrid.matchedSignals, ...conv.matchedSignals])), source: hybrid.source }
    : { level: hybrid.level, matchedSignals: Array.from(new Set([...hybrid.matchedSignals, ...conv.matchedSignals.filter((s) => s === "sustained-distress")])), source: hybrid.source };
  const safetyCoverage: "full" | "limited" = input.classifier && risk.source !== "regex+llm-failed" ? "full" : "limited";

  let best: EmotionLabel = "neutral";
  let bestScore = 0;
  for (const [label, res] of Object.entries(LEXICON) as [EmotionLabel, RegExp[]][]) {
    const score = res.reduce((n, r) => n + (input.message.match(new RegExp(r.source, "gi"))?.length ?? 0), 0);
    if (score > bestScore) { best = label; bestScore = score; }
  }
  const exclam = (input.message.match(/!/g) || []).length;
  const intensity = best === "neutral" ? 0 : Math.min(1, 0.35 + 0.2 * bestScore + 0.05 * exclam);

  return {
    risk: { level: risk.level, matchedSignals: risk.matchedSignals },
    riskSource: risk.source,
    safetyCoverage,
    emotionLabel: best,
    emotionIntensity: Number(intensity.toFixed(2)),
  };
}
