import { Router, Request, Response } from "express";
import { getMultiAIProvider } from "../lib/ai";

export const statusRouter = Router();

statusRouter.get("/", (_req: Request, res: Response) => {
  try {
    const ai = getMultiAIProvider();
    const info = ai.getStatus();

    return res.json({
      status: "ok",
      ...info,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});
