/**
 * Run with: npx tsx eval/run_failover_eval.ts
 *
 * Drives eval/faultInjector.ts across a small set of representative user
 * messages, for every fault scenario (nominal -> all-external-down),
 * and writes eval/results/failover_degradation.csv (Feature 4.3 output).
 * No live API keys needed - all providers are mocked, only the local
 * MindfulProvider fallback runs real (offline, rule-based) code.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAllScenarios } from "./faultInjector";
import { SYSTEM_PROMPT } from "../src/lib/ai/systemPrompt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLE_MESSAGES = [
  "I've had a really overwhelming week at work and I don't know how to unwind.",
  "I feel kind of disconnected from my friends lately, not sure why.",
  "Can you help me think through how to set better boundaries with my family?",
];

async function main() {
  const resultsDir = path.join(__dirname, "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const csvRows: string[] = [
    "sample_message_idx,scenario,description,final_provider,final_model,attempts,latency_ms",
  ];

  console.log("Running failover fault-injection study across", SAMPLE_MESSAGES.length, "sample messages\n");

  for (let i = 0; i < SAMPLE_MESSAGES.length; i++) {
    const message = SAMPLE_MESSAGES[i];
    const results = await runAllScenarios(
      [{ role: "user", content: message }],
      SYSTEM_PROMPT
    );

    console.log(`Message ${i + 1}: "${message}"`);
    console.log(
      "scenario".padEnd(20),
      "final provider".padEnd(24),
      "latency (ms)".padEnd(14),
      "attempts"
    );
    for (const r of results) {
      console.log(
        r.scenario.padEnd(20),
        r.finalProvider.padEnd(24),
        String(r.latencyMs).padEnd(14),
        r.attempts.join(" -> ")
      );
      csvRows.push(
        [
          i,
          r.scenario,
          `"${r.description}"`,
          r.finalProvider,
          r.finalModel ?? "",
          `"${r.attempts.join(" -> ")}"`,
          r.latencyMs,
        ].join(",")
      );
    }
    console.log("");
  }

  const outPath = path.join(resultsDir, "failover_degradation.csv");
  fs.writeFileSync(outPath, csvRows.join("\n") + "\n", "utf-8");
  console.log(`Wrote ${outPath}`);
  console.log(
    "\nNOTE: mock providers here return canned replies (no real quality variation), " +
      "so this run demonstrates the harness and timing/failover-path behavior only. " +
      "To get real response-quality degradation numbers, swap createMockProvider's " +
      "'success' branch for actual (rate-limited, budgeted) calls to the real providers, " +
      "or LLM-judge the mock/real replies for a quality score per scenario."
  );
}

main().catch((err) => {
  console.error("Failover eval run failed:", err);
  process.exit(1);
});
