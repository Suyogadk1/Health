# MindCare - demo guide (for faculty walkthrough)

## What it is
A safety-first mental-wellbeing chat companion. A message passes through a
**7-agent typed pipeline**:

1. Intake/Router - validate, resolve conversation, persist the user turn
2. Emotion - risk screening (regex, optionally + LLM) and a coarse emotion label
3. Memory - recent chat turns, the user's wellbeing check-ins, summaries of earlier chats
4. Graph Retrieval - symptoms/coping strategies from a Neo4j knowledge graph
5. Safety - pre-generation gate; high-risk input never reaches a generation model
6. Response Composer - builds the prompt, calls the Gemini/Grok/Nemotron failover chain,
   then Agent B reviews the draft; word-limit and output-risk checks
7. Insight/Reflection - internal note + check-in nudge decision

Code: `backend/src/lib/pipeline/`. Offline test: `cd backend && npm run test:pipeline`.

## Run it
```
cd backend  && cp .env.example .env   # add keys later (works without them: offline fallback)
npm install && npm run dev            # http://localhost:5001
cd ../frontend && cp .env.example .env.local
npm install && npm run dev            # http://localhost:3000
```
Without any keys the app runs on the offline rule-based fallback and the
in-memory store; Neo4j and the LLM tiers switch on when their keys are present.

Optional graph: set NEO4J_* in `backend/.env`, then `cd backend && npm run seed:graph`.

## 5-minute demo script
1. Open the site, click **Explore as Guest** (or **Sign up**: any email, code **123456**), then complete a wellbeing check-in on the dashboard. **Log out** is in the sidebar; each email/guest gets separate chats and check-ins.
2. Chat: "work has been really overwhelming and I can't sleep" - watch the reply use
   the check-in context; the response JSON lists `contextSections`, `emotion`, `stageTimings`.
3. Chat: "I killed it at my presentation" - not flagged (figurative language).
4. Chat a high-risk sentence - the crisis response is returned without calling a model.
5. `npm test` in `backend/` - safety eval, failover eval, ablation, pipeline checks.

## About demo accounts
Without Supabase keys, login/sign-up is a **demo mode**: any email works, the code is always
123456, passwords are not checked, and data lives in memory (cleared on restart). It is for
demonstration only and is not secure authentication. Real accounts need the `SUPABASE_*` keys.

## Evaluation (offline, reproducible)
See `backend/eval/README.md` and `backend/eval/LIMITATIONS_AND_FUTURE_WORK.md`.
Not a clinical tool: do not use with vulnerable users without a validated classifier.


## Safety note for the demo
Without API keys the app runs rules-only safety (the API returns `safetyCoverage: "limited"`). It will miss many indirectly phrased crisis messages (see `backend/eval/SAFETY_HARDENING.md`). Add an LLM key before showing the safety feature, and describe it as a screening aid, not a safety guarantee.
