/**
 * Run with: npx tsx eval/run_safety_eval.ts
 *
 * Loads eval/safety_test_set.jsonl (Agent A: incoming-message risk
 * classification) and eval/safety_review_test_set.jsonl (Agent B: draft-
 * reply review), computes precision/recall/F1 per class and overall
 * false-negative rate, and prints a results table. No API keys required —
 * Agent B runs in heuristic-fallback mode by default (see
 * safetyOrchestrator.ts); pass an AIProvider to reviewAndFinalize() to
 * score with a live LLM reviewer instead.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRisk, assessRiskHybrid } from "../src/lib/safety/riskAssessment";
import { reviewAndFinalize } from "../src/lib/safety/safetyOrchestrator";
import type { RiskLevel } from "../src/lib/safety/safetyTypes";
import type { AIProvider } from "../src/lib/ai/provider";

const LIVE = process.argv.includes("--live");
const LIVE_A = process.argv.includes("--live-a");
const SET_ARG = (process.argv.find((a) => a.startsWith("--set=")) || "--set=combined").split("=")[1];
const AGENT_A_FILE = `safety_test_set_${SET_ARG}.jsonl`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SafetyTestCase {
  text: string;
  true_label: RiskLevel;
  source: string;
}

interface ReviewTestCase {
  user_message: string;
  draft_reply: string;
  expected_agent_b_level: RiskLevel;
  note: string;
}

function loadJsonl<T>(filename: string): T[] {
  const filePath = path.join(__dirname, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

const LEVELS: RiskLevel[] = ["none", "moderate", "high"];

function computeMetrics(predicted: RiskLevel[], actual: RiskLevel[]) {
  const perClass: Record<RiskLevel, { tp: number; fp: number; fn: number }> = {
    none: { tp: 0, fp: 0, fn: 0 },
    moderate: { tp: 0, fp: 0, fn: 0 },
    high: { tp: 0, fp: 0, fn: 0 },
  };

  for (let i = 0; i < predicted.length; i++) {
    const pred = predicted[i];
    const truth = actual[i];
    if (pred === truth) {
      perClass[truth].tp++;
    } else {
      perClass[pred].fp++;
      perClass[truth].fn++;
    }
  }

  const rows = LEVELS.map((level) => {
    const { tp, fp, fn } = perClass[level];
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { level, tp, fp, fn, precision, recall, f1 };
  });

  // False-negative rate specifically for "high" risk being predicted as
  // something lower (none or moderate) - this is the metric that matters
  // most in a safety-critical context, distinct from generic per-class FN.
  const highCases = actual
    .map((truth, i) => ({ truth, pred: predicted[i] }))
    .filter((c) => c.truth === "high");
  const missedHighRisk = highCases.filter((c) => c.pred !== "high").length;
  const highRiskFalseNegativeRate = highCases.length === 0 ? 0 : missedHighRisk / highCases.length;

  const accuracy = predicted.filter((p, i) => p === actual[i]).length / predicted.length;

  return { rows, accuracy, highRiskFalseNegativeRate, totalCases: predicted.length, missedHighRisk };
}

function printTable(title: string, rows: ReturnType<typeof computeMetrics>["rows"]) {
  console.log(`\n${title}`);
  console.log("level".padEnd(10), "precision".padEnd(11), "recall".padEnd(9), "f1".padEnd(6), "tp/fp/fn");
  for (const r of rows) {
    console.log(
      r.level.padEnd(10),
      r.precision.toFixed(2).padEnd(11),
      r.recall.toFixed(2).padEnd(9),
      r.f1.toFixed(2).padEnd(6),
      `${r.tp}/${r.fp}/${r.fn}`
    );
  }
}

async function evalAgentA(classifier?: AIProvider) {
  const cases = loadJsonl<SafetyTestCase>(AGENT_A_FILE);
  const predicted: RiskLevel[] = [];
  const actual: RiskLevel[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (classifier) {
      process.stdout.write(`\rEvaluating hybrid case ${i + 1}/${cases.length}...`);
      await new Promise((r) => setTimeout(r, 600));
    }
    const result = classifier ? await assessRiskHybrid(c.text, classifier, 12000) : assessRisk(c.text);
    predicted.push(result.level);
    actual.push(c.true_label);
  }
  if (classifier) console.log("");

  const metrics = computeMetrics(predicted, actual);
  printTable(`=== Agent A (${classifier ? "hybrid regex+LLM" : "regex v2"}) on ${AGENT_A_FILE} ===`, metrics.rows);
  console.log(`Overall accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(
    `High-risk false-negative rate: ${(metrics.highRiskFalseNegativeRate * 100).toFixed(1)}% ` +
      `(${metrics.missedHighRisk} missed out of ${cases.filter((c) => c.true_label === "high").length} true-high cases)`
  );

  // Print misclassified cases so they're easy to inspect / expand the test set from.
  const misses = cases.filter((c, i) => predicted[i] !== c.true_label);
  if (misses.length > 0) {
    console.log("\nMisclassified cases:");
    misses.forEach((c, idx) => {
      const i = cases.indexOf(c);
      console.log(`  [${c.source}] "${c.text}" -> predicted "${predicted[i]}", true "${c.true_label}"`);
    });
  }

  return metrics;
}

async function evalAgentB(reviewer?: AIProvider, label = "heuristic mode") {
  const cases = loadJsonl<ReviewTestCase>("safety_review_test_set.jsonl");
  let fallbacks = 0;
  const predicted: RiskLevel[] = [];
  const actual: RiskLevel[] = [];

  for (const c of cases) {
    const decision = await reviewAndFinalize(c.user_message, c.draft_reply, { reviewerProvider: reviewer, timeoutMs: 12000 });
    predicted.push(decision.agentBLevel);
    actual.push(c.expected_agent_b_level);
    if (reviewer && decision.agentBReasoning?.startsWith("LLM reviewer fallback")) fallbacks++;
  }
  if (reviewer && fallbacks > 0) {
    console.warn(`WARNING: ${fallbacks}/${cases.length} live reviews fell back to the heuristic (timeout/error); live numbers are contaminated.`);
  }

  const metrics = computeMetrics(predicted, actual);
  printTable(`=== Agent B (draft-reply reviewer, ${label}) ===`, metrics.rows);
  console.log(`Overall accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);

  const misses = cases.filter((c, i) => predicted[i] !== c.expected_agent_b_level);
  if (misses.length > 0) {
    console.log("\nMisclassified cases:");
    misses.forEach((c, idx) => {
      const i = cases.indexOf(c);
      console.log(
        `  "${c.user_message}" / reply: "${c.draft_reply}" -> predicted "${predicted[i]}", expected "${c.expected_agent_b_level}" (${c.note})`
      );
    });
  }

  return metrics;
}

async function main() {
  try { await import("dotenv/config"); } catch { /* dotenv optional; env may already be set */ }
  console.log("Running safety evaluation harness against demo labeled test sets.");
  console.log(
    "NOTE: Agent A set = 174 reviewed cases (single-reviewer pass; see README), Agent B set = 13 cases. " +
      "Independent dual-rater review and a larger Agent B set are listed as future work.\n"
  );
  const a = await evalAgentA();
  if (LIVE_A) {
    const { NemotronUltraProvider: NU } = await import("../src/lib/ai/nemotronProvider");
    if (!process.env.NVIDIA_API_KEY) { console.error("--live-a needs NVIDIA_API_KEY"); }
    else await evalAgentA(new NU());
  }
  const bHeuristic = await evalAgentB();

  if (!LIVE) {
    console.log("\n(Pass --live with NVIDIA_API_KEY set to also score Agent B with the live Nemotron Ultra reviewer.)");
    return;
  }
  const { NemotronUltraProvider } = await import("../src/lib/ai/nemotronProvider");
  if (!process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY.includes("placeholder")) {
    console.error("\n--live requested but NVIDIA_API_KEY is not set; skipping live comparison.");
    return;
  }
  const reviewer = new NemotronUltraProvider();
  const bLive = await evalAgentB(reviewer, `live LLM: ${process.env.NEMOTRON_ULTRA_MODEL || "nemotron-ultra"}`);

  console.log("\n=== Agent B: heuristic vs live-LLM ===");
  console.log("mode".padEnd(14), "accuracy".padEnd(10), "high-recall");
  const hi = (m: ReturnType<typeof computeMetrics>) => m.rows.find((r) => r.level === "high")!.recall.toFixed(2);
  console.log("heuristic".padEnd(14), (bHeuristic.accuracy * 100).toFixed(1).padEnd(10), hi(bHeuristic));
  console.log("live-llm".padEnd(14), (bLive.accuracy * 100).toFixed(1).padEnd(10), hi(bLive));
  void a;
}

main().catch((err) => {
  console.error("Eval run failed:", err);
  process.exit(1);
});
