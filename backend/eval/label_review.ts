/**
 * Run with: npx tsx eval/label_review.ts
 *
 * Steps through eval/safety_test_set_expanded_candidates.jsonl one case at
 * a time so a human can confirm or correct each AI-drafted label before it
 * is trusted as ground truth. This is the step that turns "AI-drafted
 * candidates" into a citable labeled test set - do not skip it.
 *
 * Controls per case:
 *   [enter]  accept the suggested label as-is
 *   n        mark as "none"
 *   m        mark as "moderate"
 *   h        mark as "high"
 *   s        skip (drop this case entirely - e.g. duplicate, unclear, bad fit)
 *   q        save progress and quit (resumable - already-reviewed cases are
 *            skipped on the next run)
 *
 * Output: eval/safety_test_set_reviewed.jsonl (human-confirmed) grows one
 * line at a time as you go, so progress is never lost even if you quit
 * partway through. Re-running the script picks up where you left off.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, "safety_test_set_expanded_candidates.jsonl");
const OUTPUT = path.join(__dirname, "safety_test_set_reviewed.jsonl");

interface Case {
  text: string;
  true_label: "none" | "moderate" | "high";
  source: string;
}

function loadJsonl(filePath: string): Case[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function main() {
  const candidates = loadJsonl(SOURCE);
  const alreadyReviewed = loadJsonl(OUTPUT);
  const reviewedTexts = new Set(alreadyReviewed.map((c) => c.text));
  const remaining = candidates.filter((c) => !reviewedTexts.has(c.text));

  if (remaining.length === 0) {
    console.log("All candidates already reviewed. Nothing to do.");
    console.log(`Reviewed set: ${OUTPUT} (${alreadyReviewed.length} cases)`);
    return;
  }

  console.log(`${alreadyReviewed.length} already reviewed, ${remaining.length} remaining.\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  const outStream = fs.createWriteStream(OUTPUT, { flags: "a" });
  let reviewedCount = alreadyReviewed.length;

  for (const c of remaining) {
    console.log(`\n[${reviewedCount + 1}/${candidates.length}] (${c.source})`);
    console.log(`  "${c.text}"`);
    console.log(`  suggested: ${c.true_label}`);
    const answer = (await ask("  [enter=accept, n/m/h=correct, s=skip, q=quit] > ")).trim().toLowerCase();

    if (answer === "q") {
      console.log(`\nSaved ${reviewedCount} reviewed cases to ${OUTPUT}. Resume anytime.`);
      rl.close();
      outStream.end();
      return;
    }
    if (answer === "s") {
      continue; // dropped, not written - won't be re-prompted next run since
      // it's still absent from OUTPUT; remove from SOURCE manually if you
      // want to permanently exclude it rather than being asked again.
    }

    const finalLabel = answer === "n" ? "none" : answer === "m" ? "moderate" : answer === "h" ? "high" : c.true_label;
    outStream.write(JSON.stringify({ ...c, true_label: finalLabel, reviewed: true }) + "\n");
    reviewedCount++;
  }

  console.log(`\nAll done. ${reviewedCount} human-reviewed cases in ${OUTPUT}.`);
  console.log("Merge with eval/safety_test_set.jsonl (deduping) before citing a combined count in the paper.");
  rl.close();
  outStream.end();
}

main().catch((err) => {
  console.error("Review session failed:", err);
  process.exit(1);
});
