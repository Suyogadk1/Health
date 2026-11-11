import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";
import { conversationsRouter } from "./routes/conversations";
import { profileRouter } from "./routes/profile";
import { checkinsRouter } from "./routes/checkins";
import { statusRouter } from "./routes/status";
import { transcribeRouter } from "./routes/transcribe";
import { speakRouter } from "./routes/speak";

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration allowing frontend from Netlify or local development
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow all localhost origins and netlify preview/production domains
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.endsWith(".netlify.app") ||
        origin.includes("mindcare") ||
        origin.includes("understory")
      ) {
        return callback(null, true);
      }
      // Reject any origin not matching the whitelist to protect APIs and prevent unauthorized cross-origin requests
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "5mb" }));
app.use("/api/transcribe", transcribeRouter);
app.use("/api/speak", speakRouter);

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Root & Health check
app.get("/", (_req, res) => {
  res.json({
    name: "MindCare API Backend",
    status: "healthy",
    version: "1.0.0",
    docs: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY_1 ||
      process.env.GEMINI_API_KEY_2 ||
      process.env.GROK_API_KEY ||
      process.env.XAI_API_KEY ||
      process.env.NVIDIA_API_KEY
    ),
  });
});

// Mount Routes
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/profile", profileRouter);
app.use("/api/checkins", checkinsRouter);
app.use("/api/ai/status", statusRouter);
app.use("/api/status", statusRouter);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Backend Uncaught Error]:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

if (process.env.NODE_ENV !== "test" && process.env.NETLIFY !== "true" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`🌿 MindCare Backend running on http://localhost:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/api/health`);
    console.log(`   AI Status:    http://localhost:${PORT}/api/ai/status`);
  });
}

export default app;
