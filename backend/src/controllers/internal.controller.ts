import { Request, Response } from "express";
import type { ErrorResponse } from "../types/api.types";
import {
  emitClipsRefresh,
  emitClipUpdate,
  emitComfyJobUpdate,
  ComfyJobUpdate,
  emitScriptJobUpdate,
  ScriptJobUpdate,
  emitUGCVideoJobUpdate,
  UGCVideoJobUpdate,
  emitAdCloneJobUpdate,
  AdCloneJobUpdate,
  emitAdPostingUpdate,
  AdPostingUpdate,
} from "../services/socket.service";


export function notifyClipsRefresh(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  emitClipsRefresh(teamId);
  console.log(`[INTERNAL] Emitted clips-refresh for team ${teamId}`);

  return res.status(200).json({ success: true });
}

export function notifyClipUpdate(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId, clipId, clip } = req.body;

  if (!teamId) {
    return res.status(400).json({ error: "teamId is required" });
  }

  emitClipUpdate(teamId, clip || { id: clipId });
  console.log(`[INTERNAL] Emitted clip-update for team ${teamId}, clip ${clipId}`);

  return res.status(200).json({ success: true });
}

export function notifyComfyJobUpdate(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId, job } = req.body as { teamId: number; job: ComfyJobUpdate };

  if (!teamId || !job) {
    return res.status(400).json({ error: "teamId and job are required" });
  }

  emitComfyJobUpdate(teamId, job);
  console.log(`[INTERNAL] Emitted comfy-job-update for team ${teamId}, job ${job.id}`);

  return res.status(200).json({ success: true });
}

export function notifyScriptJobUpdate(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId, update } = req.body as { teamId: number; update: ScriptJobUpdate };

  if (!teamId || !update) {
    return res.status(400).json({ error: "teamId and update are required" });
  }

  emitScriptJobUpdate(teamId, update);
  console.log(`[INTERNAL] Emitted script-job-update for team ${teamId}, script ${update.scriptId}`);

  return res.status(200).json({ success: true });
}

export function notifyUGCVideoJobUpdate(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId, update } = req.body as { teamId: number; update: UGCVideoJobUpdate };

  if (!teamId || !update) {
    return res.status(400).json({ error: "teamId and update are required" });
  }

  emitUGCVideoJobUpdate(teamId, update);
  console.log(`[INTERNAL] Emitted ugc-video-job-update for team ${teamId}, job ${update.jobId}`);

  return res.status(200).json({ success: true });
}

export function notifyAdCloneJobUpdate(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId, update } = req.body as { teamId: number; update: AdCloneJobUpdate };

  if (!teamId || !update) {
    return res.status(400).json({ error: "teamId and update are required" });
  }

  emitAdCloneJobUpdate(teamId, update);
  console.log(`[INTERNAL] Emitted ad-clone-job-update for team ${teamId}, project ${update.projectId}`);

  return res.status(200).json({ success: true });
}

export function notifyAdPostingUpdate(req: Request, res: Response<{ success: boolean } | ErrorResponse>) {
  const { teamId, update } = req.body as { teamId: number; update: AdPostingUpdate };

  if (!teamId || !update) {
    return res.status(400).json({ error: "teamId and update are required" });
  }

  emitAdPostingUpdate(teamId, update);
  console.log(`[INTERNAL] Emitted ad-posting-update for team ${teamId}, clip ${update.clipId}`);

  return res.status(200).json({ success: true });
}

