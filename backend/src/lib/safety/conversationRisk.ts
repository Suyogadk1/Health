import { assessRisk } from "./riskAssessment";
import type { RiskAssessment, RiskLevel } from "./safetyTypes";

const ORDER: Record<RiskLevel, number> = { none: 0, moderate: 1, high: 2 };
const max = (a: RiskLevel, b: RiskLevel): RiskLevel => (ORDER[a] >= ORDER[b] ? a : b);

/**
 * Multi-turn risk tracking. Risk often builds up across messages rather than
 * appearing in one sentence. Given the user's earlier messages (oldest first)
 * and the current one, this returns the level to act on.
 *
 * Rules (all raise-only; none can lower the single-message level):
 *  1. Assess the current message alone.
 *  2. Assess the last 3 user messages joined (catches intent split across turns).
 *  3. A HIGH message in the last 6 turns keeps the session elevated: a current
 *     moderate becomes high, a current none becomes moderate (care follow-up).
 *  4. 3+ moderate turns among the last 5 adds a "sustained-distress" signal
 *     (level stays moderate; the composer is told to check in directly).
 */
export function assessConversationRisk(previousUserMessages: string[], current: string): RiskAssessment {
  const now = assessRisk(current);
  const prior = previousUserMessages.slice(-6);
  let level: RiskLevel = now.level;
  const signals = [...now.matchedSignals];

  const joined = [...prior.slice(-2), current].join(". ");
  const j = assessRisk(joined);
  if (ORDER[j.level] > ORDER[level]) { level = j.level; signals.push("multi-turn-joined"); }

  const priorLevels = prior.map((m) => assessRisk(m).level);
  if (priorLevels.includes("high")) {
    if (level === "moderate") { level = "high"; signals.push("sustained-risk-after-high"); }
    else if (level === "none") { level = max(level, "moderate"); signals.push("post-crisis-followup"); }
  }
  const mods = [...priorLevels.slice(-4), now.level].filter((l) => l === "moderate" || l === "high").length;
  if (mods >= 3) signals.push("sustained-distress");

  return { level, matchedSignals: Array.from(new Set(signals)) };
}
