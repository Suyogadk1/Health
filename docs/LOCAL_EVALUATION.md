# Local evaluation and conversation export

The chat application supports opt-in local research recording, classifier/reviewer traces, bounded provider calls and export of the messages loaded in the browser. These features provide operational records, not independently verified safety labels or clinical validation.

## Run locally

Install backend and frontend dependencies using their lockfiles (`npm ci --prefix backend` and `npm ci --prefix frontend`). Configure authorized provider credentials in the ignored `backend/.env`, following `backend/.env.example`; never commit keys. Start the backend with `npm run dev:backend` and the frontend with `npm run dev:frontend`. Open `http://localhost:3000/chat`.

For an isolated Next development build, set `MINDCARE_BUILD_DIR=.next-local` in the frontend process environment. The frontend routes chat and health to the standalone backend before the legacy Next handlers.

## Freeze a new recording configuration

From the repository root, run:

```text
python tools/evaluation/freeze_local.py --output recordings/local-evaluation
```

This preserves a source snapshot and credential-free manifest and refuses to overwrite an existing manifest. Keep model/routing settings fixed after freezing. Source hashes include prompts, timeouts and sampling implementations. Changing any evaluated source or model setting requires a new configuration and separate cohort. Provider-side model versions and credentials also need documented version changes; the manifest does not pin external weights.

Add these lines to the local `backend/.env`, then restart the backend:

```text
EVAL_RECORDING_DIR="../recordings/local-evaluation/sessions"
EVAL_FREEZE_PATH="../recordings/local-evaluation/configuration.json"
```

Paths are relative to the backend process working directory. `/api/health` reports `evaluationRecording: true` when enabled. Recording is disabled in Netlify. This format uses `source_sha256` and `environment_settings`; the historical `backend/eval/freeze_camera_ready.py` manifest is for its separate capture tool and is not interchangeable.

## Collect and preserve records

The recording UI requires a participant code and explicit consent. It explains that local records include inputs, generated drafts, decisions and timing, and that configured external providers process messages. Use a fresh chat for each participant. Context is isolated by participant code and conversation identifier. The local recorder verifies frozen sources/settings, appends durable JSONL events and recovers recorded context after process restarts. Keep the data private and complete the applicable consent and institutional requirements before research collection.

Use **Export chat** before leaving the conversation. A browser export may contain only loaded history; the private server log retains the recorded context. A continuation is part of the same conversation, not a new independent participant. Never share exported HTML rating packets publicly: generated packets embed private conversation text.

Core final latency measures pipeline work until the final reply is ready, before recording-file overhead. Browser round-trip time additionally includes request/transport overhead; it does not measure completed visual rendering. Keep successful classification, natural fallback, rules bypass and injected failures separate. A returned response and an override flag are not human safety judgments.

## Evaluation utilities

- `backend/eval/run_current_ablation.ts`: actual generation-tier/offline capture with matched screen/reviewer branches. Failed calls remain unavailable outputs; screen-high generation is explicitly counterfactual.
- `backend/eval/capture_camera_ready.ts` and `camera_ready_report.py`: per-case capture and subgroup/failure reporting for their documented manifest/schema.
- `backend/eval/compare_human_ratings.py`: pre-adjudication agreement and Cohen's kappa for two completed human rating files.
- `backend/eval/test_safety_traces.ts`: classifier/reviewer trace, fallback and cancellation checks without live provider calls.
- `tools/evaluation/import_frozen_conversation.py EXPORT.json`: validate consent, source hashes and the exported segment against private local server logs, preserving received versions. Handles continuation exports without counting them as new participants.
- `tools/evaluation/prepare_ablation_rating_packets.py`: create separate blank, blinded HTML packets from `recordings/final-evaluation/ablation-results.jsonl`. Generated HTML embeds private content and stays ignored.
- `tools/evaluation/analyze_ablation_ratings.py A.json B.json`: validate independently completed output ratings, calculate agreement and agreed-label outcomes, and export disagreements for human adjudication.
- `tools/evaluation/run_full_pipeline_replay.ts`: run actual nominal/injected-classifier-failure replays from private `recordings/final-evaluation/replay-cases.jsonl` and its configuration manifest. Invoke with the backend's `tsx` from the backend working directory; it makes live provider calls and refuses to overwrite output.

New independently authored conversations and independent human labels must be collected after the chosen freeze. Preserve original ratings and adjudication history. Do not generate labels and attribute them to an independent person. Use a preselected target per conversation or account for clustering; do not treat related turns or duplicated gate branches as independent trials. Report empty denominators as unavailable and explain assumptions behind confidence intervals.

The repository excludes manuscripts, local recordings, generated rating packets, individual ratings, credentials and build output. An operational replay of known cases does not establish independent generalization, and missing ablation ratings must remain explicit.
