import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRisk, assessRiskHybrid } from "../src/lib/safety/riskAssessment";
import { NemotronUltraProvider } from "../src/lib/ai/nemotronProvider";
import type { RiskLevel } from "../src/lib/safety/safetyTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SafetyTestCase {
  text: string;
  true_label: RiskLevel;
  source: string;
}

const LEVELS: RiskLevel[] = ["none", "moderate", "high"];

async function main() {
  const filePath = path.join(__dirname, "safety_test_set_locked2.jsonl");
  const raw = fs.readFileSync(filePath, "utf-8");
  const cases: SafetyTestCase[] = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  console.log("=========================================================================");
  console.log(`LIVE EVALUATION: Hybrid Agent A on LOCKED2 (Blind Holdout Set, n=${cases.length})`);
  console.log("=========================================================================");

  const classifier = new NemotronUltraProvider();
  console.log(`Classifier Model: ${classifier.model}`);
  console.log(`Endpoint: https://integrate.api.nvidia.com/v1/chat/completions`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const predicted: RiskLevel[] = [];
  const actual: RiskLevel[] = [];
  const results: any[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`Evaluating case ${i + 1}/${cases.length}... `);
    const t0 = performance.now();
    // 25s timeout to allow Nemotron's internal reasoning tokens to complete cleanly
    const res = await assessRiskHybrid(c.text, classifier, 25000);
    const ms = Math.round(performance.now() - t0);
    console.log(`[${res.level}] (${res.source}, ${ms}ms)`);
    predicted.push(res.level);
    actual.push(c.true_label);
    results.push(res);
    // Throttle to respect rate limits
    await new Promise((r) => setTimeout(r, 400));
  }

  // 3x3 Confusion Matrix
  const matrix: Record<RiskLevel, Record<RiskLevel, number>> = {
    none: { none: 0, moderate: 0, high: 0 },
    moderate: { none: 0, moderate: 0, high: 0 },
    high: { none: 0, moderate: 0, high: 0 },
  };

  for (let i = 0; i < actual.length; i++) {
    matrix[actual[i]][predicted[i]]++;
  }

  const perClass = LEVELS.map((level) => {
    const tp = matrix[level][level];
    let fp = 0;
    let fn = 0;
    for (const other of LEVELS) {
      if (other !== level) {
        fp += matrix[other][level];
        fn += matrix[level][other];
      }
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const support = tp + fn;
    return { level, support, tp, fp, fn, precision, recall, f1 };
  });

  const correct = predicted.filter((p, i) => p === actual[i]).length;
  const accuracy = correct / cases.length;

  const highCases = cases.filter((c) => c.true_label === "high");
  const missedHigh = cases.map((c, i) => ({ ...c, pred: predicted[i] }))
    .filter((c) => c.true_label === "high" && c.pred !== "high").length;
  const highMissRate = missedHigh / highCases.length;

  console.log("\n=========================================================================");
  console.log("FINAL RESULTS SUMMARY: Hybrid Agent A on LOCKED2 (Blind Holdout Set)");
  console.log("=========================================================================");
  console.log(`Overall Accuracy: ${(accuracy * 100).toFixed(2)}% (${correct}/${cases.length})`);
  console.log(`High-Risk False-Negative Rate: ${(highMissRate * 100).toFixed(2)}% (${missedHigh} missed out of ${highCases.length} true-high cases)`);
  console.log(`High-Risk Recall: ${((1 - highMissRate) * 100).toFixed(2)}% (${highCases.length - missedHigh}/${highCases.length} caught)`);

  console.log("\nPer-Class Metrics:");
  console.log("Level".padEnd(10), "Support".padEnd(9), "Precision".padEnd(11), "Recall".padEnd(9), "F1".padEnd(8), "TP/FP/FN");
  for (const r of perClass) {
    console.log(
      r.level.padEnd(10),
      String(r.support).padEnd(9),
      r.precision.toFixed(3).padEnd(11),
      r.recall.toFixed(3).padEnd(9),
      r.f1.toFixed(3).padEnd(8),
      `${r.tp}/${r.fp}/${r.fn}`
    );
  }

  console.log("\n3x3 Confusion Matrix (Rows = Actual, Columns = Predicted):");
  console.log("Actual \\ Pred".padEnd(15), "None".padEnd(8), "Moderate".padEnd(10), "High".padEnd(8));
  for (const act of LEVELS) {
    console.log(
      act.padEnd(15),
      String(matrix[act].none).padEnd(8),
      String(matrix[act].moderate).padEnd(10),
      String(matrix[act].high).padEnd(8)
    );
  }

  const misclassified = cases
    .map((c, i) => ({ idx: i + 1, ...c, pred: predicted[i], res: results[i] }))
    .filter((c) => c.pred !== c.true_label);

  console.log(`\nMisclassified Cases (${misclassified.length} total):`);
  if (misclassified.length === 0) {
    console.log("  None! (100% accuracy)");
  } else {
    misclassified.forEach((m) => {
      console.log(`  [Case ${m.idx} | ${m.source}]`);
      console.log(`    Input: "${m.text}"`);
      console.log(`    Expected: "${m.true_label}" | Predicted: "${m.pred}" (Source: ${m.res.source})`);
      console.log(`    Signals: ${JSON.stringify(m.res.matchedSignals)}`);
    });
  }

  // Save results to file for permanent record
  const resultText = [
    `=== Agent A (Hybrid regex+LLM Nemotron Ultra) on safety_test_set_locked2.jsonl ===`,
    `Date: ${new Date().toISOString()}`,
    `Overall accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${cases.length})`,
    `High-risk false-negative rate: ${(highMissRate * 100).toFixed(1)}% (${missedHigh}/${highCases.length} missed)`,
    `High-risk recall: ${((1 - highMissRate) * 100).toFixed(1)}%`,
    `\nPer-class:`,
    ...perClass.map(r => `${r.level}: P=${r.precision.toFixed(2)}, R=${r.recall.toFixed(2)}, F1=${r.f1.toFixed(2)} (${r.tp}/${r.fp}/${r.fn})`),
  ].join("\n");

  fs.writeFileSync(path.join(__dirname, "results", "safety_eval_locked2_hybrid.txt"), resultText + "\n", "utf-8");
  console.log(`\nWrote backend/eval/results/safety_eval_locked2_hybrid.txt`);
}

main().catch((err) => {
  console.error("Evaluation failed:", err);
  process.exit(1);
});
