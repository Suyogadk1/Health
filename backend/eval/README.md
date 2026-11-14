> CAMERA-READY AUDIT: Historical exploratory evidence only. These developer-authored sets do not independently validate a frozen final hybrid system. Version labels and counts conflict across archived reports; consult original traces. Current-configuration real-output ablation, external ratings, and failure-stratified final-response timing are pending. See `backend/eval/CAMERA_READY.md`.

# Evaluation Harness

Limitations/future-work status: `LIMITATIONS_AND_FUTURE_WORK.md`.

Implements Features 2–4 from `feature-spec-ieee-additions.md`. Everything
here runs with `npx tsx`, no build step, no live API keys required.

## Scripts

### `run_safety_eval.ts`
```
npx tsx eval/run_safety_eval.ts
```
Evaluates Agent A (`assessRisk`, the existing regex classifier) against
`safety_test_set.jsonl`, and Agent B (`reviewAndFinalize`'s draft-reply
review, heuristic mode) against `safety_review_test_set.jsonl`. Prints
precision/recall/F1 per risk level, overall accuracy, and — the number that
matters most for a safety-critical system — the **high-risk false-negative
rate**, plus a list of every misclassified case so the test set is easy to
extend.

**Current status.** Agent A was rewritten (regex v2: normalization, passive-ideation,
third-party and figurative-language handling) and evaluated on two sets:

| set | cases | v1 accuracy | v1 high-risk miss | v2 accuracy | v2 high-risk miss | Hybrid (Rules+LLM) Acc | Hybrid High-Risk Miss |
|---|---|---|---|---|---|---|---|
| combined (development, 174) | 174 | 44.8% | 60/72 (83.3%) | 99.4% | 1/72 (1.4%) | 94.3% | 1/72 (1.4%) |
| fresh (challenge, 59) | 59 | 35.6% | 21/22 (95.5%) | 40.7% | 19/22 (86.4%) | 89.8% | 0/22 (0.0%) |
| locked v1 (colloquial, 61) | 61 | N/A | 21/24 (87.5%) | 91.8% | 3/24 (12.5%) | 96.7% | 0/24 (0.0%) |
| locked2 (gold blind, 47) | 47 | N/A | 19/20 (95.0%) | 40.4% | 19/20 (95.0%) | **93.6%** | **0/20 (0.0%)** |

**Empirical Live Finding:** As demonstrated above, deterministic regex rules collapsed on out-of-distribution phrasings (95.0% crisis miss rate on the blind holdout set `locked2`). In contrast, the hybrid tier (`assessRiskHybrid` with Nemotron Ultra) achieved **93.6% accuracy and 100% high-risk recall (0.0% miss rate, 20/20 caught)**, providing exploratory evidence that requires independent testing before any generalization claim.

**Label provenance:** the 174 cases are synthetic and were reviewed by a single
reviewer (2 corrections, 7 borderline flags). This is not inter-rater
reliability; see `LIMITATIONS_AND_FUTURE_WORK.md`.

### Flags
`--set=combined|fresh` selects the Agent A set; `--live-a` scores the hybrid
regex+LLM classifier; `--live` scores Agent B with Nemotron Ultra.

### `run_safety_eval.ts --live`
`npm run test:safety:live` additionally scores Agent B with the live
Nemotron Ultra reviewer and prints heuristic vs live side by side (needs
`NVIDIA_API_KEY`; not yet executed).

### `run_ablation.ts`
`npm run eval:ablation` (offline, deterministic; worst-case dismissive drafts for
risky inputs, supportive drafts for benign ones):

| set | config | unsafe release (high) | over-block (none) |
|---|---|---|---|
| combined | no safety | 100% | 0% |
| combined | A / B / A+B | 1.4% | 0% |
| fresh | no safety | 100% | 0% |
| fresh | A only / A+B | 86.4% | 8.7% |
| fresh | B only | 86.4% | 0% |

Takeaway: Agent B's heuristic reviewer calls `assessRisk`, so it never catches
anything Agent A misses; A+B equals A. The layers only become complementary
with an LLM-based Agent B and/or an LLM tier in Agent A.

### `cohens_kappa.ts`
`npm run eval:kappa -- raterA.jsonl raterB.jsonl` for two independent reviewers.

### `run_failover_quality_eval.ts`
`npm run eval:failover-quality` — live, LLM-judged quality per failover scenario
(needs all provider keys; not yet executed).

### `run_failover_eval.ts`
```
npx tsx eval/run_failover_eval.ts
```
Runs `faultInjector.ts`'s four scenarios (nominal → all-external-down)
across a handful of sample messages, using the exact same failover code
(`runProviderPool`, extracted from `MultiAIProvider`) that production uses
— so this isn't a reimplementation that could drift from real behavior.
Providers are mocked (no live API calls, no keys needed) so this run
currently demonstrates **failover-path correctness and latency**, not
response-quality degradation. Writes `results/failover_degradation.csv`.

**To get real quality-degradation numbers** (the more interesting half of
Feature 4): replace the mock "success" branch with real, budgeted calls to
each provider (small token limits, a handful of requests, mindful of your
API quota and cost), or LLM-judge each provider's reply for a 1–5 quality
score per scenario, and average across more than 3 sample messages.

## Extending the labeled test sets
Both `.jsonl` files are flat, one JSON object per line. Add cases directly;
no schema migration needed. Keep sourcing honest in the `source` /
`note` field (`synthetic`, `synthetic-hard-negative`,
`reviewed-dataset:<name>`, etc.) — a paper's methodology section needs to
say where the labels came from.

## Reproducibility notes for the paper
- Provider model versions are read from env vars at runtime
  (`GEMINI_MODEL_1`, `GROK_MODEL`, etc.) — pin and report the exact model
  strings you evaluated against, since "gemini-3.6-flash" today may not be
  the same weights next month.
- `run_safety_eval.ts`'s Agent B heuristic mode is deterministic (no LLM
  call), so its numbers are exactly reproducible. If you switch Agent B to
  live-LLM mode (`reviewerProvider` option), note the model + temperature
  used, since those results won't be exactly reproducible run to run.


See `SAFETY_HARDENING.md` for the v3 changes, the locked/blind sets (`--set=locked`, `--set=locked2`) and the honest generalisation numbers.
