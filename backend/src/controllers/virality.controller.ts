import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { viralityService } from "../services/virality/virality.service";

// an account is what we used call a 'target'. Its simply an account of a competitor
export async function listAccountsController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const accounts = await viralityService.getAccountsByTeam(teamId);
    return res.json({ accounts });
  } catch (error) {
    console.error("List virality accounts error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to list accounts" });
  }
}

export async function addAccountController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const { platform, profileUrl, competitorId } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }
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

    if (!["instagram", "tiktok", "x"].includes(platform)) {
      return res.status(400).json({ error: "Only Instagram, TikTok, and X are supported" });
    }

    const account = await viralityService.addAccount(
      teamId,
      platform,
      profileUrl,
      competitorId ? parseInt(competitorId) : undefined
    );
    return res.status(201).json({ account });
  } catch (error: any) {
    console.error("Add virality account error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("already being tracked")) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message?.includes("Maximum")) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to add account" });
  }
}

export async function getAccountController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const accountId = parseInt(req.params.accountId);

    if (isNaN(teamId) || isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid team or account ID" });
    }

    const account = await viralityService.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      return res.status(404).json({ error: "Account not found" });
    }

    return res.json({ account });
  } catch (error) {
    console.error("Get virality account error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get account" });
  }
}

export async function deleteAccountController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const accountId = parseInt(req.params.accountId);

    if (isNaN(teamId) || isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid team or account ID" });
    }

    await viralityService.deleteAccount(accountId, teamId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Delete virality account error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to delete account" });
  }
}

export async function syncAccountController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const accountId = parseInt(req.params.accountId);

    if (isNaN(teamId) || isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid team or account ID" });
    }
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const result = await viralityService.syncAccount(accountId, teamId);
    return res.json(result);
  } catch (error: any) {
    console.error("Sync virality account error:", error);
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
    const accountId = parseInt(req.params.accountId);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (isNaN(teamId) || isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid team or account ID" });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const posts = await viralityService.getPostsByAccount(
      accountId,
      teamId,
      Math.min(limit, 100), // limit to 100 posts (this can be changed later)
      offset,
      startDate,
      endDate
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
    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const stats = await viralityService.getDashboardStats(teamId, startDate, endDate);
    return res.json(stats);
  } catch (error) {
    console.error("Get virality dashboard error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to get dashboard stats" });
  }
}

// ── Competitor Controllers ──

export async function listCompetitorsController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    const competitors = await viralityService.getCompetitorsByTeam(teamId);
    return res.json({ competitors });
  } catch (error) {
    console.error("List competitors error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to list competitors" });
  }
}

export async function createCompetitorController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const { name, description } = req.body;

    if (isNaN(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Competitor name is required" });
    }

    const competitor = await viralityService.createCompetitor(teamId, name.trim(), description?.trim());
    return res.status(201).json({ competitor });
  } catch (error) {
    console.error("Create competitor error:", error);
    Sentry.captureException(error);
    return res.status(500).json({ error: "Failed to create competitor" });
  }
}

export async function updateCompetitorController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const competitorId = parseInt(req.params.competitorId);
    const { name, description } = req.body;

    if (isNaN(teamId) || isNaN(competitorId)) {
      return res.status(400).json({ error: "Invalid team or competitor ID" });
    }

    const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
    if (!hasAccess) {
      return res.status(403).json({
        error: "Virality tracking requires a Studio plan or higher",
        code: "PLAN_REQUIRED",
      });
    }

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: "Competitor name cannot be empty" });
    }

    const competitor = await viralityService.updateCompetitor(competitorId, teamId, {
      name: name?.trim(),
      description: description?.trim(),
    });
    return res.json({ competitor });
  } catch (error: any) {
    console.error("Update competitor error:", error);
    Sentry.captureException(error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Failed to update competitor" });
  }
}

export async function getCompetitorController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const competitorId = parseInt(req.params.competitorId);

    if (isNaN(teamId) || isNaN(competitorId)) {
      return res.status(400).json({ error: "Invalid team or competitor ID" });
    }

    const competitor = await viralityService.getCompetitorWithAccounts(competitorId, teamId);
    return res.json({ competitor });
  } catch (error: any) {
    console.error("Get competitor error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to get competitor" });
  }
}

export async function deleteCompetitorController(req: AuthRequest, res: Response) {
  try {
    const teamId = parseInt(req.params.teamId);
    const competitorId = parseInt(req.params.competitorId);

    if (isNaN(teamId) || isNaN(competitorId)) {
      return res.status(400).json({ error: "Invalid team or competitor ID" });
    }

    await viralityService.deleteCompetitor(competitorId, teamId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("Delete competitor error:", error);
    Sentry.captureException(error);

    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: "Failed to delete competitor" });
  }
}
