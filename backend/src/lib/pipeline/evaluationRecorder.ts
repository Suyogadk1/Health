import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Local opt-in research records. Never enabled automatically in deployment. */
export function evaluationEnabled(): boolean {
  return Boolean(process.env.EVAL_RECORDING_DIR) && process.env.NETLIFY !== "true";
}

export function recordingSession(participant: string, conversationId: string) {
  if (!evaluationEnabled()) return undefined;
  const directory = path.resolve(process.env.EVAL_RECORDING_DIR!);
  const manifestPath = process.env.EVAL_FREEZE_PATH;
  if (!manifestPath) throw new Error("evaluation_freeze_missing");
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes.toString("utf8"));
  const workspace = path.resolve(__dirname, "../../../..");
  for (const [relative, expected] of Object.entries(manifest.source_sha256)) {
    const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(workspace, relative))).digest("hex");
    if (actual !== expected) throw new Error("evaluation_frozen_source_changed");
  }
  for (const [key, expected] of Object.entries(manifest.environment_settings)) {
    if ((process.env[key] ?? null) !== expected) throw new Error("evaluation_frozen_environment_changed");
  }
  const configurationHash = crypto.createHash("sha256").update(bytes).digest("hex");
  fs.mkdirSync(directory, { recursive: true });
  const id = crypto.createHash("sha256").update(participant + ":" + conversationId).digest("hex").slice(0, 24);
  const filename = path.join(directory, id + ".jsonl");
  return {
    id, configurationHash,
    append(event: Record<string, unknown>) {
      const fd = fs.openSync(filename, "a");
      try {
        fs.writeSync(fd, JSON.stringify({ schemaVersion: 1, recordedAt: new Date().toISOString(), participant, conversationId, configurationHash, ...event }) + "\n");
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
    },
    previousTranscript(): { role: "user" | "assistant"; content: string }[] {
      if (!fs.existsSync(filename)) return [];
      let transcript: { role: "user" | "assistant"; content: string }[] = [];
      for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/).filter(Boolean)) {
        try { const event = JSON.parse(line); if (Array.isArray(event.transcript)) transcript = event.transcript; }
        catch { /* Preserve an interrupted line on disk; recover complete records only. */ }
      }
      return transcript;
    },
  };
}
