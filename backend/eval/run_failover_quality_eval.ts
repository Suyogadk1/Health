/**
 * Run with: npx tsx eval/run_failover_quality_eval.ts
 *
 * LIVE evaluation (requires network + API keys; NOT runnable offline).
 * Complements run_failover_eval.ts (mock, routing-only) by measuring whether
 * reply QUALITY degrades as the system fails over down the tier chain.
 *
 * For each scenario, real providers (from env) are used for tiers that are
 * "up" and forced to throw for tiers that are "down"; the local
 * MindfulProvider is the real offline fallback. Each reply is scored 1-5 by
 * an LLM judge (NemotronUltraProvider) on a short rubric. Budgeted: default
 * 6 messages x 4 scenarios = 24 generations + 24 judge calls
 * (override with --n=<messages>).
 *
 * Caveat to report in the paper: the judge is an LLM, not a human; also
 * the judge model may be the same family as a tier under test. Pin model
 * strings and report judge agreement spot-checks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProviderPool } from "../src/lib/ai/multiProvider";
import type { ProviderEntry } from "../src/lib/ai/multiProvider";
import { GeminiProvider } from "../src/lib/ai/geminiProvider";
import { GrokProvider } from "../src/lib/ai/grokProvider";
import { MindfulProvider } from "../src/lib/ai/mindfulProvider";
import { NemotronUltraProvider } from "../src/lib/ai/nemotronProvider";
import type { AIProvider } from "../src/lib/ai/provider";
import { SYSTEM_PROMPT } from "../src/lib/ai/systemPrompt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const N = Number((process.argv.find((a: string) => a.startsWith("--n=")) || "--n=6").split("=")[1]);

const MESSAGES = [
  "I've had a really overwhelming week at work and I don't know how to unwind.",
  "I feel kind of disconnected from my friends lately, not sure why.",
  "Can you help me think through how to set better boundaries with my family?",
  "I keep replaying my failures over and over in my head.",
  "I've been having trouble getting out of bed most mornings.",
  "I'm nervous about a job interview next week.",
  "I feel like I'm failing at everything I try.",
  "my sleep has been off this week, any tips",
].slice(0, N);

const RUBRIC = `Score the REPLY to the USER MESSAGE from a mental-wellbeing companion app, 1-5:
5 = warm, validating, relevant, safe, gently actionable
3 = acceptable but generic or slightly off-tone
1 = irrelevant, cold, unsafe, or incoherent
Respond with strict JSON only: {"score":<1-5>,"reason":"<short>"}`;

const down = (name: string): AIProvider => ({ name, async generate() { throw new Error(`forced outage: ${name}`); } });

async function main() {
  const need = ["GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GROK_API_KEY", "NVIDIA_API_KEY"];
  try { await import("dotenv/config"); } catch {}
  const missing = need.filter((k) => !process.env[k] && !(k === "GEMINI_API_KEY_1" && process.env.GEMINI_API_KEY));
  if (missing.length) { console.error(`Missing env: ${missing.join(", ")}. This eval needs live keys.`); process.exit(2); }

  const g1 = new GeminiProvider({ apiKey: (process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY)!, model: process.env.GEMINI_MODEL_1 || "gemini-3.6-flash", name: "Gemini 1 (Primary)" });
  const g2 = new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY_2!, model: process.env.GEMINI_MODEL_2 || "gemini-3.6-flash", name: "Gemini 2 (Secondary)" });
  const grok = new GrokProvider({ apiKey: process.env.GROK_API_KEY!, model: process.env.GROK_MODEL || "grok-2-latest", name: "Grok (xAI)" });
  const judge = new NemotronUltraProvider();
  const tiers = [
    { id: "gemini-1", name: "Gemini 1 (Primary)", real: g1, model: process.env.GEMINI_MODEL_1 || "gemini-3.6-flash" },
    { id: "gemini-2", name: "Gemini 2 (Secondary)", real: g2, model: process.env.GEMINI_MODEL_2 || "gemini-3.6-flash" },
    { id: "grok", name: "Grok (xAI)", real: grok, model: process.env.GROK_MODEL || "grok-2-latest" },
  ];
  const scenarios = [
    { label: "nominal", upCount: 3 }, { label: "gemini1-down", upCount: 2 },
    { label: "gemini-both-down", upCount: 1 }, { label: "all-external-down", upCount: 0 },
  ];
  const rows = ["message_idx,scenario,final_provider,final_model,score,reason"];
  const sums: Record<string, number[]> = {};

  for (let i = 0; i < MESSAGES.length; i++) {
    for (const sc of scenarios) {
      const firstUp = tiers.length - sc.upCount; // tiers before this index are forced down
      const pool: ProviderEntry[] = tiers.map((t, idx) => ({
        id: t.id, name: t.name, model: t.model, isConfigured: true,
        provider: idx < firstUp ? down(t.name) : t.real,
      }));
      const out = await runProviderPool(pool, [{ role: "user", content: MESSAGES[i] }], SYSTEM_PROMPT, new MindfulProvider());
      let score = 0, reason = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
          const raw = await judge.generate([{ role: "user", content: `USER MESSAGE:\n${MESSAGES[i]}\n\nREPLY:\n${out.reply}` }], RUBRIC);
          const j = JSON.parse(raw.replace(/```json|```/g, "").trim());
          score = Number(j.score); reason = String(j.reason || "").replace(/[",\n]/g, " ");
          if (score >= 1 && score <= 5) break;
        } catch (e: any) {
          reason = `judge-failed: ${e?.message}`.replace(/[",\n]/g, " ");
          if (attempt === 2) console.warn(`Judge failed on attempt 3: ${e?.message}`);
        }
      }
      if (score >= 1 && score <= 5) (sums[sc.label] ||= []).push(score);
      rows.push([i, sc.label, out.provider, out.model ?? "", score, `"${reason}"`].join(","));
      console.log(`msg ${i + 1} ${sc.label.padEnd(18)} ${out.provider.padEnd(22)} score=${score}`);
    }
  }
  console.log("\nMean judge score per scenario (n=" + MESSAGES.length + "):");
  for (const sc of scenarios) {
    const v = sums[sc.label] || [];
    console.log(sc.label.padEnd(20), v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "n/a", `(${v.length} judged)`);
  }
  fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "results", "failover_quality_live.csv"), rows.join("\n") + "\n");
  console.log("\nWrote results/failover_quality_live.csv");
}
main().catch((e) => { console.error(e); process.exit(1); });
