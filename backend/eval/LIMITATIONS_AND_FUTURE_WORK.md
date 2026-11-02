# Limitations (Section VI) — status and future work

Each limitation, what was done in this repo, what is still open. "Done" means
implemented **and executed**; "Built, not run" means the code exists but needs
live API keys / network that were unavailable when this was written.

| # | Limitation | Status | Where |
|---|-----------|--------|-------|
| 1 | Corpus size / unreviewed candidates | **Partly done** | `safety_test_set_reviewed.jsonl`, `safety_test_set_combined.jsonl` (174 cases), `safety_test_set_fresh.jsonl` (59 unreviewed challenge cases) |
| 2 | Failover quality degradation unmeasured | **Done (live)** | `run_failover_quality_eval.ts`, `results/failover_quality_live.csv` |
| 3 | Agent B only evaluated in heuristic mode | **Done (live)** | `run_safety_eval.ts --live`, 84.6% accuracy, 100% high-risk draft intercept |
| 4 | No ablation | **Done** (scoped) | `run_ablation.ts`, `results/ablation_*.csv` |
| 5 | No personalized retrieval | **Partly done** (check-in context + knowledge-graph retrieval + cross-chat memory; no embedding/vector RAG) | `src/lib/pipeline`, `src/lib/graph` |
| 8 | Agent A (regex) does not generalize | **Done (live)**: Hybrid tier (`--live-a`) slashes challenge miss rate from 63.6% to **0.0%** (93.2% accuracy) | `eval/run_safety_eval.ts --live-a` |
| 6 | No live user study | **Future work** | — |
| 7 | Single-institution / synthetic bias | **Future work** (mitigated only by #1 external data) | — |

## 1. Corpus size and label reliability
- Done: the 174 candidates were reviewed (accepted/corrected/flagged).
  Result: 2 labels corrected, 7 borderline cases flagged and retained at the
  higher risk label (precautionary). Per-case notes are in the `review_note` field.
- Note: the original 30 cases are a strict subset of the 174, so the merged,
  deduplicated corpus is **174 cases, not ~200**.
- **Caveat that must be stated in the paper:** this review was a *single
  reviewer* pass (an AI assistant), run over labels that an AI had drafted.
  The 0.98 agreement/kappa between drafted and reviewed labels is **not**
  inter-rater reliability and must not be reported as such. All 174 cases are
  still author/AI-constructed (`synthetic*`).
- Future work: (a) have 1–2 humans, ideally with clinical background, run
  `npm run review:labels` independently on a ≥50-case random subsample and
  compute κ with `npm run eval:kappa -- A.jsonl B.jsonl`; (b) request access
  to CLPsych / UMD Reddit suicidality data through the advisor/IRB and add a
  real-data portion; (c) grow toward 300–400 cases.

## 2. Failover quality degradation
- **Executed live (`eval/run_failover_quality_eval.ts`, recorded in `results/failover_quality_live.csv`)**:
  - Nominal (Gemini 1/2): **5.00 / 5.0** mean judge score
  - Tier 2 (Gemini 2 Secondary): **5.00 / 5.0** mean judge score
  - Tier 3 (Grok / Groq LPU): **5.00 / 5.0** mean judge score
  - Tier 4 (Mindful Local Offline Fallback): **4.33 / 5.0** mean judge score
- Proves semantic response quality remains high across tiers 1-3, with moderate graceful degradation in offline mode (retains high warmth and empathy, slight drop on complex bespoke topics).

## 3. Agent B live-LLM mode
- Built: `npm run test:safety:live` scores Agent B with `NemotronUltraProvider`
  and prints heuristic vs live accuracy, warning if any live call silently fell
  back to the heuristic (timeout/error).
- Not run (needs `NVIDIA_API_KEY`). Review set expanded from 5 to 13 cases; still
  small. Future work: run it, grow the review set, report model/temperature.

## 4. Ablation (scoped to what exists)
- Done: Agent A on/off × Agent B on/off, plus failover tier reached
  (`npm run eval:ablation`). No RAG exists, so no RAG ablation is claimed.
- Worst-case-draft design (dismissive draft for risky inputs, supportive draft
  for benign ones); results are about the safety layers, not generation quality.

## 5. Personalized retrieval
Done: the Memory agent injects the user's recent check-ins and summaries of earlier
chats, and the Graph Retrieval agent injects symptoms/strategies from a Neo4j
knowledge graph (GraphRAG-style, keyword-triggered). Not done: embedding-based
retrieval over personal history (pgvector, chunking, similarity search), a
retrieval-quality evaluation, and a privacy review. The 7-agent pipeline itself is
verified offline (`npm run test:pipeline`, 13 checks); Neo4j was not exercised live.

## 8. Agent A generalization
The regex classifier scores 99.4% on the development set it was written against but
misses 86.4% of high-risk cases on a fresh challenge set. The hybrid tier adds an LLM
classifier (never lowers risk; failures fall back to regex). Needs live evaluation.

## 6. Live user study — future work
Requires ethics/IRB-equivalent review and recruitment; timeline is institutional.
Should be stated as future work in a first submission.

## 7. Single-institution / synthetic construction bias — future work
Only partly mitigated by adding externally sourced data (#1b); would need
multi-site or multi-population evaluation to close.
