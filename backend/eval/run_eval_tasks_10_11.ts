import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRisk, assessRiskHybrid } from "../src/lib/safety/riskAssessment";
import { reviewAndFinalize } from "../src/lib/safety/safetyOrchestrator";
import { NemotronUltraProvider } from "../src/lib/ai/nemotronProvider";
import type { RiskLevel } from "../src/lib/safety/safetyTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadJsonl<T>(filename: string): T[] {
  const filePath = path.join(__dirname, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

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

const LEVELS: RiskLevel[] = ["none", "moderate", "high"];

function computeConfusionMatrix(predicted: RiskLevel[], actual: RiskLevel[]) {
  // matrix[actual][predicted]
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
  const accuracy = correct / predicted.length;

  return { matrix, perClass, accuracy, total: predicted.length };
}

async function runTask10() {
  console.log("=====================================================================");
  console.log("TASK 10: Hybrid Agent A (Rules + Nemotron Ultra LLM) on Dev & Fresh Sets");
  console.log("=====================================================================");

  const classifier = new NemotronUltraProvider();
  console.log(`Classifier Model: ${classifier.model}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  for (const setName of ["fresh", "combined"]) {
    const fileName = `safety_test_set_${setName}.jsonl`;
    console.log(`\n-------------------------------------------------------------`);
    console.log(`Evaluating Set: ${setName.toUpperCase()} (${fileName})`);
    console.log(`-------------------------------------------------------------`);

    const cases = loadJsonl<SafetyTestCase>(fileName);
    const predicted: RiskLevel[] = [];
    const actual: RiskLevel[] = [];
    const results: any[] = [];

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      // Regex check first; if regex is high, hybrid returns immediately without LLM call
      const res = await assessRiskHybrid(c.text, classifier, 12000);
      predicted.push(res.level);
      actual.push(c.true_label);
      results.push(res);
      // Small throttle to avoid rate limits if LLM was called
      if (res.source === "llm") {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const { matrix, perClass, accuracy, total } = computeConfusionMatrix(predicted, actual);

    console.log(`\nOverall Accuracy: ${(accuracy * 100).toFixed(2)}% (${predicted.filter((p, i) => p === actual[i]).length}/${total})`);

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

    if (setName === "fresh") {
      const benignCases = cases.map((c, i) => ({ ...c, pred: predicted[i], res: results[i] })).filter((c) => c.true_label === "none");
      const falseAlarms = benignCases.filter((c) => c.pred !== "none");
      console.log(`\nFalse alarms on the ${benignCases.length} benign fresh cases: ${falseAlarms.length} / ${benignCases.length}`);
      if (falseAlarms.length > 0) {
        console.log("False alarm details:");
        falseAlarms.forEach((fa) => {
          console.log(`  "${fa.text}" -> Predicted "${fa.pred}" (Signals: ${JSON.stringify(fa.res.matchedSignals)})`);
        });
      }
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
  }
}

async function runTask11() {
  console.log("\n=====================================================================");
  console.log("TASK 11: Agent B Live Reviewer on 13 Review Cases");
  console.log("=====================================================================");

  const cases = loadJsonl<ReviewTestCase>("safety_review_test_set.jsonl");
  const reviewer = new NemotronUltraProvider();

  console.log(`Reviewer Model: ${reviewer.model}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const rows: any[] = [];
  const escalated: any[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    // 1. Heuristic evaluation
    const heur = await reviewAndFinalize(c.user_message, c.draft_reply, { timeoutMs: 5000 });
    // 2. Live LLM reviewer evaluation
    const live = await reviewAndFinalize(c.user_message, c.draft_reply, { reviewerProvider: reviewer, timeoutMs: 12000 });

    const row = {
      caseNum: i + 1,
      user_message: c.user_message,
      draft_reply: c.draft_reply,
      expected: c.expected_agent_b_level,
      heuristic: heur.agentBLevel,
      live: live.agentBLevel,
      heuristicMatches: heur.agentBLevel === c.expected_agent_b_level,
      liveMatches: live.agentBLevel === c.expected_agent_b_level,
      liveReasoning: live.agentBReasoning,
      note: c.note,
    };
    rows.push(row);

    if (live.agentBLevel !== c.expected_agent_b_level) {
      escalated.push(row);
    }
  }

  console.log("\nAll 13 Cases Table:");
  console.log("#".padEnd(3), "Expected".padEnd(10), "Heuristic".padEnd(11), "Live LLM".padEnd(10), "User Message / Note");
  for (const r of rows) {
    console.log(
      String(r.caseNum).padEnd(3),
      r.expected.padEnd(10),
      r.heuristic.padEnd(11),
      r.live.padEnd(10),
      `"${r.user_message.slice(0, 35)}..." (${r.note.slice(0, 35)}...)`
    );
  }

  console.log(`\nDiscrepancies / Escalations in Live Reviewer (${escalated.length} cases):`);
  for (const esc of escalated) {
    console.log(`\nCase #${esc.caseNum}:`);
    console.log(`  User Message: "${esc.user_message}"`);
    console.log(`  Draft Reply:  "${esc.draft_reply}"`);
    console.log(`  Expected Level:  "${esc.expected}"`);
    console.log(`  Heuristic Level: "${esc.heuristic}"`);
    console.log(`  Live LLM Level:  "${esc.live}"`);
    console.log(`  Note/Benchmark Intent: "${esc.note}"`);
    console.log(`  Live LLM Reasoning:    "${esc.liveReasoning}"`);
  }
}

async function main() {
  await runTask10();
  await runTask11();
}

main().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
