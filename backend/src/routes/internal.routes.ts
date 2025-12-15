import { Router, Request, Response } from "express";
import { emitClipsRefresh, emitClipUpdate } from "../services/socket.service";

const router = Router();

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

const validateInternalKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers["x-internal-api-key"];

  if (!INTERNAL_API_KEY) {
    return next();
  }

  if (apiKey !== INTERNAL_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

router.post("/notify/clips-refresh", validateInternalKey, (req: Request, res: Response) => {
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  emitClipsRefresh(teamId);
  console.log(`[INTERNAL] Emitted clips-refresh for team ${teamId}`);

  return res.status(200).json({ success: true });
});

router.post("/notify/clip-update", validateInternalKey, (req: Request, res: Response) => {
  const { teamId, clipId, clip } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  emitClipUpdate(teamId, clip || { id: clipId });
  console.log(`[INTERNAL] Emitted clip-update for team ${teamId}, clip ${clipId}`);

  return res.status(200).json({ success: true });
});

export default router;
