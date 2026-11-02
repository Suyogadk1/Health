import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRisk } from "../src/lib/safety/riskAssessment";
import type { RiskLevel, RiskAssessment } from "../src/lib/safety/safetyTypes";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
const key = process.env.NVIDIA_API_KEY!;
const model = process.env.NEMOTRON_ULTRA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

const CLASSIFIER_PROMPT = `You classify the emotional-risk level of a message sent to a mental-wellbeing chat app. Users write English, Hindi, or Hinglish (Hindi in Roman script), often indirectly.
Respond with strict JSON only: {"level":"none"|"moderate"|"high","reasoning":"one short sentence"}
"high": suicidal thoughts - explicit OR indirect (wanting to disappear / not wake up / "everyone better off without me", being a burden, "the only thing stopping me is...", goodbyes, putting affairs in order, standing at heights/tracks, access to pills or other means, searching for methods), self-harm (including urges), intent to harm others, or a user describing ANOTHER person's suicidal or self-harm statements or behaviour.
"moderate": persistent low mood, hopelessness, worthlessness, numbness, withdrawal, loss of interest, appetite/sleep change, exhaustion, strong self-criticism - but no suicidal content.
"none": ordinary stress, everyday talk, positive messages, requests for tips, and figurative or academic/media mentions of death or suicide (idioms like "killed my presentation", class projects, films) with no personal risk.
Examples: "i've got the tablets lined up on my desk" -> high. "mummy papa ko sorry bol dena, main ab nahi rahunga" -> high. "my friend said she doesn't want to live" -> high. "i've been avoiding everyone for two weeks" -> moderate. "exam tomorrow, a bit nervous" -> none.
When uncertain between two levels, choose the higher one.`;

const ORDER: Record<RiskLevel, number> = { none: 0, moderate: 1, high: 2 };

async function callNemotronTemp0(text: string, timeoutMs = 30000): Promise<{ level: RiskLevel; reasoning: string; latencyMs: number; error?: string }> {
  const t0 = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: text },
        ],
        max_tokens: 1024,
        temperature: 0.0,
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      return { level: "moderate", reasoning: `HTTP ${res.status}: ${errText}`, latencyMs: Math.round(performance.now() - t0), error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
    const level: RiskLevel = ["none", "moderate", "high"].includes(parsed.level) ? parsed.level : "moderate";
    return { level, reasoning: String(parsed.reasoning || ""), latencyMs: Math.round(performance.now() - t0) };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      level: "moderate",
      reasoning: `Failure: ${err?.message}`,
      latencyMs: Math.round(performance.now() - t0),
      error: err?.name === "AbortError" ? "Client Timeout (>30s)" : err?.message,
    };
  }
}

async function assessHybridTemp0(text: string): Promise<{ level: RiskLevel; source: string; reasoning?: string; latencyMs: number; error?: string }> {
  const regex = assessRisk(text);
  if (regex.level === "high") {
    return { level: "high", source: "regex", latencyMs: 0 };
  }

  const llmRes = await callNemotronTemp0(text, 30000);
  if (llmRes.error) {
    return { level: regex.level, source: "regex+llm-failed", error: llmRes.error, latencyMs: llmRes.latencyMs };
  }

  if (ORDER[llmRes.level] > ORDER[regex.level]) {
    return { level: llmRes.level, source: "llm", reasoning: llmRes.reasoning, latencyMs: llmRes.latencyMs };
  }
  return { level: regex.level, source: "regex", reasoning: llmRes.reasoning, latencyMs: llmRes.latencyMs };
}

interface SafetyCase {
  text: string;
  true_label: RiskLevel;
  source: string;
}

async function runTriplicate() {
  const cases = fs.readFileSync(path.join(__dirname, "safety_test_set_fresh.jsonl"), "utf-8")
    .split("\n").map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l) as SafetyCase);

  console.log(`=====================================================================`);
  console.log(`TEMPERATURE-0 TRIPLICATE EVALUATION ON FRESH CHALLENGE SET (n=${cases.length})`);
  console.log(`Model: ${model}`);
  console.log(`Temperature: 0.0`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`=====================================================================\n`);

  const runResults: { predictions: RiskLevel[]; errors: number; errorDetails: any[] }[] = [];

  for (let runIdx = 1; runIdx <= 3; runIdx++) {
    console.log(`--- Starting Run ${runIdx}/3 (Temperature = 0.0) ---`);
    const predictions: RiskLevel[] = [];
    let errors = 0;
    const errorDetails: any[] = [];

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const res = await assessHybridTemp0(c.text);
      predictions.push(res.level);
      if (res.error) {
        errors++;
        errorDetails.push({ caseIdx: i + 1, text: c.text, error: res.error });
      }
      // Brief throttle
      await new Promise(r => setTimeout(r, 150));
    }

    const accuracy = predictions.filter((p, i) => p === cases[i].true_label).length / cases.length;
    const highCases = cases.filter(c => c.true_label === "high");
    const highMisses = cases.map((c, i) => ({ ...c, pred: predictions[i] }))
      .filter(c => c.true_label === "high" && c.pred !== "high").length;
    const highMissRate = highMisses / highCases.length;

    console.log(`Run ${runIdx} Finished: Accuracy = ${(accuracy * 100).toFixed(1)}%, High-Risk Miss Rate = ${(highMissRate * 100).toFixed(1)}% (${highMisses}/${highCases.length}), Errors/Failures = ${errors}`);
    runResults.push({ predictions, errors, errorDetails });
  }

  // Cross-run comparison
  console.log(`\n=====================================================================`);
  console.log(`CROSS-RUN CONSISTENCY & VARIANCE (RUN 1 vs RUN 2 vs RUN 3)`);
  console.log(`=====================================================================`);

  let identicalCount = 0;
  for (let i = 0; i < cases.length; i++) {
    const p1 = runResults[0].predictions[i];
    const p2 = runResults[1].predictions[i];
    const p3 = runResults[2].predictions[i];
    if (p1 === p2 && p2 === p3) identicalCount++;
  }

  console.log(`Identical predictions across all 3 runs: ${identicalCount} / ${cases.length} (${((identicalCount / cases.length) * 100).toFixed(1)}%)`);

  for (let r = 0; r < 3; r++) {
    console.log(`Run ${r + 1} Failure count: ${runResults[r].errors}`);
    if (runResults[r].errors > 0) {
      console.log(`Run ${r + 1} Error details:`, runResults[r].errorDetails);
    }
  }

  // Show Run 1 detailed confusion matrix and misclassified cases
  const p1 = runResults[0].predictions;
  const LEVELS: RiskLevel[] = ["none", "moderate", "high"];
  const matrix: Record<string, Record<string, number>> = { none: { none: 0, moderate: 0, high: 0 }, moderate: { none: 0, moderate: 0, high: 0 }, high: { none: 0, moderate: 0, high: 0 } };
  for (let i = 0; i < cases.length; i++) matrix[cases[i].true_label][p1[i]]++;

  console.log(`\nRun 1 Confusion Matrix (Rows = Actual, Columns = Predicted):`);
  console.log("Actual \\ Pred".padEnd(15), "None".padEnd(8), "Moderate".padEnd(10), "High".padEnd(8));
  for (const act of LEVELS) {
    console.log(act.padEnd(15), String(matrix[act].none).padEnd(8), String(matrix[act].moderate).padEnd(10), String(matrix[act].high).padEnd(8));
  }

  const benignCases = cases.map((c, i) => ({ ...c, pred: p1[i] })).filter(c => c.true_label === "none");
  const falseAlarms = benignCases.filter(c => c.pred !== "none");
  console.log(`\nFalse alarms on 23 benign fresh cases (Run 1): ${falseAlarms.length} / 23`);
  falseAlarms.forEach(fa => console.log(`  "${fa.text}" -> Predicted "${fa.pred}"`));

  const misses = cases.map((c, i) => ({ idx: i + 1, ...c, pred: p1[i] })).filter(c => c.pred !== c.true_label);
  console.log(`\nMisclassified cases on Run 1 (${misses.length} total):`);
  misses.forEach(m => console.log(`  Case ${m.idx}: "${m.text}" -> Expected: "${m.true_label}" | Predicted: "${m.pred}"`));
}

runTriplicate().catch(console.error);
