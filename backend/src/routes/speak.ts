import { Router } from "express";
import { spawn } from "child_process";
import path from "path";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { checkRateLimit } from "../lib/utils/rateLimit";

export const speakRouter = Router();
speakRouter.post("/", requireAuth, (req: AuthenticatedRequest, res) => {
  const { text, language = "en-US" } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 6000 || !["en-US", "hi-IN", "ta-IN", "te-IN", "ne-NP"].includes(language)) return res.status(400).json({ error: "Invalid speech request." });
  if (!checkRateLimit(`tts:${req.user!.id}`).allowed) return res.status(429).json({ error: "Please wait briefly before playing more speech." });
  res.setHeader("Cache-Control", "no-store");
  const child = spawn(process.env.TTS_PYTHON || "python", [path.resolve(__dirname, "../../scripts/speak.py")], { windowsHide: true });
  const chunks: Buffer[] = [];
  let size = 0;
  const timeout = setTimeout(() => { child.kill(); if (!res.headersSent) res.status(504).json({ error: "Voice generation timed out." }); }, 35000);
  const cleanup = () => { clearTimeout(timeout); if (!child.killed) child.kill(); };
  res.on("close", cleanup);
  child.stdout.on("data", (data: Buffer) => { size += data.length; if (size > 8 * 1024 * 1024) cleanup(); else chunks.push(data); });
  child.stderr.on("data", () => {});
  child.stdin.on("error", () => {});
  child.on("error", () => { clearTimeout(timeout); if (!res.headersSent) res.status(503).json({ error: "Female voice service is unavailable. Install backend requirements-voice.txt." }); });
  child.on("close", code => {
    clearTimeout(timeout);
    if (res.headersSent || res.destroyed) return;
    if (code !== 0 || !size) return res.status(502).json({ error: "Female voice generation is temporarily unavailable." });
    res.type("audio/mpeg").send(Buffer.concat(chunks));
  });
  child.stdin.end(JSON.stringify({ text: text.trim(), language }));
});
