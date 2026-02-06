import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { viralityService } from "../services/virality/virality.service";

export async function listTargetsController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Check plan access
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const targets = await viralityService.getTargetsByTeam(teamId);
    return res.json({ targets });
  } catch (error) {
    console.error("List virality targets error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to list targets" });
  }
}

export async function addTargetController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const { platform, profileUrl } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Check plan access
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    if (!platform || !profileUrl) {
      return res
        .status(400)
        .json({ error: "Platform and profile URL are required" });
    }

    if (platform !== "instagram") {
      return res.status(400).json({ error: "Only Instagram is supported currently" });
    }

    const target = await viralityService.addTarget(teamId, platform, profileUrl);
    return res.status(201).json({ target });
  } catch (error: any) {
    console.error("Add virality target error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("already being tracked")) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message?.includes("Maximum")) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to add target" });
  }
}

export async function getTargetController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const targetId = parseInt(req.params.targetId);

    if (isNaN(teamId) || isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid team or target ID" });
    }

    const target = await viralityService.getTargetById(targetId);
    if (!target || target.team_id !== teamId) {
      return res.status(404).json({ error: "Target not found" });
    }

    return res.json({ target });
  } catch (error) {
    console.error("Get virality target error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get target" });
  }
}

export async function deleteTargetController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const targetId = parseInt(req.params.targetId);

    if (isNaN(teamId) || isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid team or target ID" });
    }

    await viralityService.deleteTarget(targetId, teamId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Delete virality target error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to delete target" });
  }
}

export async function syncTargetController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const targetId = parseInt(req.params.targetId);

    if (isNaN(teamId) || isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid team or target ID" });
    }

    // Check plan access
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const result = await viralityService.syncTarget(targetId, teamId);
    return res.json(result);
  } catch (error: any) {
    console.error("Sync virality target error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Sync failed: " + error.message });
  }
}

export async function getPostsController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const targetId = parseInt(req.params.targetId);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (isNaN(teamId) || isNaN(targetId)) {
      return res.status(400).json({ error: "Invalid team or target ID" });
    }

    const posts = await viralityService.getPostsByTarget(
      targetId,
      teamId,
      Math.min(limit, 50),
      offset
    );
    return res.json({ posts });
  } catch (error: any) {
    console.error("Get virality posts error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to get posts" });
  }
}

export async function getDashboardController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    // Check plan access
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const stats = await viralityService.getDashboardStats(teamId);
    return res.json(stats);
  } catch (error) {
    console.error("Get virality dashboard error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get dashboard stats" });
  }
}
