export interface CheckinRow {
  mood: string;
  stress_level?: number;
  sleep_quality?: number;
  energy_level?: number;
  clarity_level?: number;
  score?: number;
  insight?: string;
  notes?: string;
  created_at: string;
}

/**
 * Formats the user's most recent wellbeing check-ins as a prompt block.
 * Returns "" when there is no history, so callers can always append it.
 * This is what makes the assistant context-aware of the user's OWN
 * check-in history (not just prior chat messages).
 */
export function formatCheckinContext(rows: CheckinRow[], limit = 3): string {
  const recent = rows.slice(0, limit);
  if (recent.length === 0) return "";
  const lines = recent.map((c) => {
    const date = new Date(c.created_at).toLocaleDateString();
    const f = (v?: number) => (typeof v === "number" ? `${v}/5` : "n/a");
    const noteText = c.notes ? ` Personal Note: "${c.notes}".` : "";
    return `- ${date}: wellbeing score ${typeof c.score === "number" ? c.score + "/100" : "n/a"}, mood "${c.mood}", stress ${f(c.stress_level)}, sleep ${f(c.sleep_quality)}, energy ${f(c.energy_level)}, clarity ${f(c.clarity_level)}.${noteText}${c.insight ? ` Insight: ${c.insight}` : ""}`;
  });
  return [
    "Here is this user's recent wellbeing check-in history, most recent first.",
    "Use it only to understand their recent context and personalize your tone -",
    "do not recite the raw numbers back at them unless it genuinely helps the conversation:",
    lines.join("\n"),
  ].join("\n");
}
