import { Router, Response } from "express";
import { store } from "../lib/store/store";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get("/", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const profile = store.getProfile(userId);
  return res.json({ data: profile });
});

profileRouter.put("/", (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const updated = store.updateProfile(userId, req.body || {});
  return res.json({ data: updated });
});
