/** Capture real pipeline outputs for independent rating; never invents gold labels. */
import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import { runChatPipeline } from "../src/lib/pipeline/orchestrator";
import { memoryStoreAdapter } from "../src/lib/pipeline/memoryStoreAdapter";
import { responseComposerAgent } from "../src/lib/pipeline/agents/responseComposerAgent";
import { MultiAIProvider } from "../src/lib/ai/multiProvider";
import { MindfulProvider } from "../src/lib/ai/mindfulProvider";
import { NemotronUltraProvider } from "../src/lib/ai/nemotronProvider";
import type { ChatMessage } from "../src/lib/ai/provider";

async function main() {
  const [input, output, tier = "auto", run = "1"] = process.argv.slice(2);
  if (!input || !output || !["auto", "offline"].includes(tier))
    throw new Error("Usage: tsx eval/capture_camera_ready.ts cases.jsonl capture.jsonl auto|offline run-id");
  if (!process.env.NVIDIA_API_KEY || process.env.HYBRID_RISK_CLASSIFIER === "false")
    throw new Error("Current hybrid evaluation requires NVIDIA_API_KEY and HYBRID_RISK_CLASSIFIER=true");
  const lock = JSON.parse(fs.readFileSync("eval/camera_ready_freeze.json", "utf8"));
  for (const [file, hash] of Object.entries(lock.files)) {
    if (crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== hash)
      throw new Error(`Frozen source changed: ${file}`);
  }
  for (const [name, value] of Object.entries(lock.environment)) {
    if ((process.env[name] ?? null) !== value) throw new Error(`Frozen setting changed: ${name}`);
  }
  const bytes = fs.readFileSync(input);
  const cases = bytes.toString("utf8").split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
  const ids = new Set<string>();
  for (const c of cases) {
    if (!c.id || ids.has(c.id) || !c.language || !c.disclosure_type || !c.response_language ||
        !Array.isArray(c.history) || typeof c.message !== "string") throw new Error("Invalid/duplicate case metadata");
    if (c.history.some((m: ChatMessage) => !["user", "assistant"].includes(m.role) || typeof m.content !== "string"))
      throw new Error("Invalid conversation history");
    ids.add(c.id);
  }
  const fd = fs.openSync(output, "wx"); // Do not overwrite an earlier experiment.
  const llm = new NemotronUltraProvider();
  const ai = new MultiAIProvider();
  const local = new MindfulProvider();
  try {
    for (const c of cases) {
      const id = crypto.randomUUID();
      memoryStoreAdapter.ensureConversation(id, id, "Independent evaluation");
      for (const m of c.history) memoryStoreAdapter.addMessage(id, id, m.role, m.content);
      let classifierCalled = false;
      let draft: string | null = null;
      let reviewerBlocked: boolean | null = null;
      const generate = async (messages: ChatMessage[], prompt: string) => {
        const system = prompt + `\nRespond in ${c.response_language}, in its native script.`;
        const result = tier === "offline"
          ? { reply: await local.generate(messages, system), provider: local.name, model: "offline-mindful-engine" }
          : await ai.generateWithDetails(messages, system);
        draft = result.reply;
        return result;
      };
      const t0 = performance.now();
      const result = await runChatPipeline({
        store: memoryStoreAdapter, generate, reviewer: llm,
        classifier: { name: llm.name, generate: async (m, s) => { classifierCalled = true; return llm.generate(m, s); } },
      }, { user: { id }, rawConversationId: id, rawMessage: c.message });
      const finalLatency = performance.now() - t0;
      const screenBlocked = result.risk === "high";
      reviewerBlocked = screenBlocked ? null : result.overridden;
      let counterfactual: unknown = null;
      if (screenBlocked) {
        // Explicitly counterfactual: actual pipeline correctly skipped generation.
        // Same production composer, with the input screen removed; retain output guards.
        const composed = await responseComposerAgent({ userMessage: c.message, riskLevel: "none",
          chatHistory: [...c.history, { role: "user", content: c.message }], checkinContextText: "",
          crossChatContextText: "", graphContextText: "", emotionLabel: result.emotionLabel,
          generate, reviewer: llm });
        counterfactual = composed;
        reviewerBlocked = composed.overridden;
      }
      fs.writeSync(fd, JSON.stringify({
        conversation_id: c.id, run, tier, language: c.language, disclosure_type: c.disclosure_type,
        history: c.history, message: c.message,
        dataset_sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        freeze_sha256: crypto.createHash("sha256").update(JSON.stringify(lock)).digest("hex"),
        timestamp: new Date().toISOString(), prediction: result.risk,
        classifier_status: !classifierCalled ? "not_called" : result.riskSource === "regex+llm-failed" ? "fallback" : "success",
        final_latency_ms: finalLatency, screen_blocked: screenBlocked, reviewer_blocked: reviewerBlocked,
        final_blocked: screenBlocked || result.overridden || result.isDangerous,
        draft, final_reply: result.reply, actual: result, counterfactual,
        counterfactual_note: screenBlocked ? "Draft and reviewer decision are from a separate screen-disabled branch; excluded from actual latency" : null,
      }) + "\n");
    }
  } finally { fs.closeSync(fd); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
