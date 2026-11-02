/**
 * Run with: npx tsx eval/cohens_kappa.ts <raterA.jsonl> <raterB.jsonl>
 *
 * Computes Cohen's kappa (and raw agreement + confusion matrix) between two
 * independent reviewers' label files over the cases they both labeled.
 * Each reviewer should run `npm run review:labels` on their own copy WITHOUT
 * seeing the other's labels, then pass the two output files here.
 * Ideal: a >=50-case random subsample labeled by both.
 */
import fs from "node:fs";

const LABELS = ["none", "moderate", "high"] as const;
const load = (p: string) =>
  new Map<string, string>(
    fs.readFileSync(p, "utf-8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)).map((d) => [d.text, d.true_label])
  );

const [pa, pb] = process.argv.slice(2);
if (!pa || !pb) { console.error("usage: cohens_kappa.ts <raterA.jsonl> <raterB.jsonl>"); process.exit(1); }
const A = load(pa), B = load(pb);
const shared = [...A.keys()].filter((t) => B.has(t));
if (shared.length === 0) { console.error("No overlapping cases."); process.exit(1); }

const n = shared.length;
const m: Record<string, Record<string, number>> = {};
for (const x of LABELS) { m[x] = {}; for (const y of LABELS) m[x][y] = 0; }
for (const t of shared) m[A.get(t)!][B.get(t)!]++;
const po = LABELS.reduce((s, l) => s + m[l][l], 0) / n;
const pe = LABELS.reduce((s, l) => s + (LABELS.reduce((a, y) => a + m[l][y], 0) / n) * (LABELS.reduce((a, x) => a + m[x][l], 0) / n), 0);
const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);

console.log(`Shared cases: ${n}`);
console.log(`Raw agreement: ${(po * 100).toFixed(1)}%`);
console.log(`Cohen's kappa: ${kappa.toFixed(3)}`);
console.log("\nRows = rater A, cols = rater B");
console.log("".padEnd(10), ...LABELS.map((l) => l.padEnd(9)));
for (const x of LABELS) console.log(x.padEnd(10), ...LABELS.map((y) => String(m[x][y]).padEnd(9)));
