# Safety hardening (v3) - what changed and what the numbers actually show

## Changes
1. **Concept-level cue layer** (`src/lib/safety/cueScoring.ts`): scores wish-to-die, burden, means/plan, farewell, finality, self-harm and distress concepts (English + Hinglish). Rounds UP when unsure ("uncertain" tier -> at least moderate). Can only raise risk; figurative/academic framing still suppresses it.
2. **Multi-turn risk** (`conversationRisk.ts`): joins recent turns, keeps a session elevated after a high turn, flags sustained distress (3+ moderate turns in 5) and tells the composer to ask directly about safety.
3. **Fail-safe behaviour**: unrecognised or garbled LLM-classifier output now fails closed to *moderate* (was "none"). Classifier outage degrades to rules and the API reports `safetyCoverage: "limited"`.
4. **Agent B reviews draft content on its own** (dismissive phrasing, diagnosis/medication advice, method detail, guarantees) instead of only re-using Agent A. Previously the ablation showed B added nothing.
5. **India helplines** in the crisis reply (Tele-MANAS 14416, 112, iCall, Vandrevala) and a short support footer on moderate/sustained replies. **Verify every number before real deployment.**
6. **Locked test sets** `safety_test_set_locked.jsonl` (61) and `safety_test_set_locked2.jsonl` (47, blind).

## Results (rules only, no LLM, offline - `results/safety_eval_*.txt`)
| Set | n | High-risk miss rate | Notes |
|---|---|---|---|
| combined (dev, rules were written against it) | 174 | 1.4% (1/72) | in-sample, not evidence of generalisation |
| fresh (earlier held-out) | 59 | 63.6% (14/22) | was 86.4% before v3 |
| locked v1 | 61 | 12.5% (3/24) | **contaminated**: cues were written after seeing its baseline (87.5% miss) |
| locked v2 (blind, run once, not tuned) | 47 | **95.0% (19/20)** | the honest generalisation number for rules |

## What this means
Rules, however many concepts they cover, do not generalise to unseen phrasing (95% miss on the blind set). The rule layer is a fast, auditable first pass and a floor; **the LLM classifier tier is the part that has to carry recall**, and it has not yet been measured live.
The label sets are written and labelled by the same AI assistant; they are not independent human gold labels.

## Still to do (needs your keys / people)
- `npm run test:safety:live-a -- --set=locked2` with NVIDIA/Gemini keys: measure the hybrid tier on the blind set. Report that number, not the rules-only one.
- Two or three human raters label locked2 independently; report Cohen's kappa.
- Never tune rules on locked2 again; write a locked3 for any later round.
