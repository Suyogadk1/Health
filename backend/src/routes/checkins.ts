import { Router, Response } from "express";
import { store } from "../lib/store/store";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

export const checkinsRouter = Router();

checkinsRouter.use(requireAuth);

// GET /api/checkins
checkinsRouter.get("/", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const checkins = store.getCheckins(userId, limit);
  const latest = store.getLatestCheckin(userId);
  return res.json({ data: checkins, latest });
});

// POST /api/checkins
checkinsRouter.post("/", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    mood = "okay",
    stressLevel,
    stress_level,
    sleepQuality,
    sleep_quality,
    energyLevel,
    energy_level,
    clarityLevel,
    clarity_level,
    score,
    insight,
    breakdown,
    notes,
  } = req.body || {};

  const created = store.addCheckin({
    user_id: userId,
    mood,
    stress_level: stressLevel ?? stress_level,
    sleep_quality: sleepQuality ?? sleep_quality,
    energy_level: energyLevel ?? energy_level,
    clarity_level: clarityLevel ?? clarity_level,
    score,
    insight,
    breakdown,
    notes,
  });

  return res.status(201).json({ data: created });
});
