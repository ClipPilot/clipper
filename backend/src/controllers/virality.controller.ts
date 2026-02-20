import * as Sentry from "@sentry/node";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { viralityService } from "../services/virality/virality.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseId(value: string): number | null {
  const n = parseInt(value);
  return isNaN(n) ? null : n;
}

function parseDateQuery(value: unknown): Date | undefined {
  return value ? new Date(value as string) : undefined;
}

const PLAN_REQUIRED_RESPONSE = {
  error: "Virality tracking requires a Studio plan or higher",
  code: "PLAN_REQUIRED",
} as const;

async function requirePlanAccess(teamId: number, res: Response): Promise<boolean> {
  const hasAccess = await viralityService.checkTeamPlanAccess(teamId);
  if (!hasAccess) {
    res.status(403).json(PLAN_REQUIRED_RESPONSE);
    return false;
  }
  return true;
}

function handleError(res: Response, label: string, error: any, fallbackMessage: string) {
  console.error(`${label}:`, error);
  Sentry.captureException(error);

  if (error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  if (error.message?.includes("already being tracked")) {
    return res.status(409).json({ error: error.message });
  }
  if (error.message?.includes("Maximum")) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
}

// ── Controller ───────────────────────────────────────────────────────────────

class ViralityController {
  // ── Account Controllers ──

  async listAccounts(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const accounts = await viralityService.getAccountsByTeam(teamId);
      return res.json({ accounts });
    } catch (error) {
      return handleError(res, "List virality accounts error", error, "Failed to list accounts");
    }
  }

  async addAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const { platform, profileUrl, competitorId, accountType } = req.body;

      if (!platform || !profileUrl) {
        return res.status(400).json({ error: "Platform and profile URL are required" });
      }
      if (!["instagram", "tiktok", "x"].includes(platform)) {
        return res.status(400).json({ error: "Only Instagram, TikTok, and X are supported" });
      }

      const validAccountTypes = ["profile", "hashtag", "keyword"];
      if (accountType && !validAccountTypes.includes(accountType)) {
        return res.status(400).json({ error: "Account type must be profile, hashtag, or keyword" });
      }

      const account = await viralityService.addAccount(
        teamId,
        platform,
        profileUrl,
        competitorId ? parseInt(competitorId) : undefined,
        accountType || "profile"
      );

      // Trigger first sync in the background
      viralityService.syncAccount(account.id, teamId).catch((err) => {
        console.error(`Initial sync failed for account ${account.id}:`, err);
      });

      return res.status(201).json({ account });
    } catch (error) {
      return handleError(res, "Add virality account error", error, "Failed to add account");
    }
  }

  async getAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      const account = await viralityService.getAccountById(accountId);
      if (!account || account.team_id !== teamId) {
        return res.status(404).json({ error: "Account not found" });
      }

      return res.json({ account });
    } catch (error) {
      return handleError(res, "Get virality account error", error, "Failed to get account");
    }
  }

  async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      await viralityService.deleteAccount(accountId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Delete virality account error", error, "Failed to delete account");
    }
  }

  async syncAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const result = await viralityService.syncAccount(accountId, teamId);
      return res.json(result);
    } catch (error: any) {
      return handleError(res, "Sync virality account error", error, "Sync failed: " + error.message);
    }
  }

  async getPosts(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = parseDateQuery(req.query.startDate);
      const endDate = parseDateQuery(req.query.endDate);

      const posts = await viralityService.getPostsByAccount(
        accountId,
        teamId,
        Math.min(limit, 100),
        offset,
        startDate,
        endDate
      );
      return res.json({ posts });
    } catch (error) {
      return handleError(res, "Get virality posts error", error, "Failed to get posts");
    }
  }

  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const startDate = parseDateQuery(req.query.startDate);
      const endDate = parseDateQuery(req.query.endDate);

      const stats = await viralityService.getDashboardStats(teamId, startDate, endDate);
      return res.json(stats);
    } catch (error) {
      return handleError(res, "Get virality dashboard error", error, "Failed to get dashboard stats");
    }
  }

  // ── Competitor Controllers ──

  async listCompetitors(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const competitors = await viralityService.getCompetitorsByTeam(teamId);
      return res.json({ competitors });
    } catch (error) {
      return handleError(res, "List competitors error", error, "Failed to list competitors");
    }
  }

  async createCompetitor(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Competitor name is required" });
      }

      const competitor = await viralityService.createCompetitor(teamId, name.trim(), description?.trim());
      return res.status(201).json({ competitor });
    } catch (error) {
      return handleError(res, "Create competitor error", error, "Failed to create competitor");
    }
  }

  async updateCompetitor(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const competitorId = parseId(req.params.competitorId);
      if (!teamId || !competitorId) return res.status(400).json({ error: "Invalid team or competitor ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const { name, description } = req.body;
      if (name !== undefined && (!name || !name.trim())) {
        return res.status(400).json({ error: "Competitor name cannot be empty" });
      }

      const competitor = await viralityService.updateCompetitor(competitorId, teamId, {
        name: name?.trim(),
        description: description?.trim(),
      });
      return res.json({ competitor });
    } catch (error) {
      return handleError(res, "Update competitor error", error, "Failed to update competitor");
    }
  }

  async getCompetitor(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const competitorId = parseId(req.params.competitorId);
      if (!teamId || !competitorId) return res.status(400).json({ error: "Invalid team or competitor ID" });

      const competitor = await viralityService.getCompetitorWithAccounts(competitorId, teamId);
      return res.json({ competitor });
    } catch (error) {
      return handleError(res, "Get competitor error", error, "Failed to get competitor");
    }
  }

  async deleteCompetitor(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const competitorId = parseId(req.params.competitorId);
      if (!teamId || !competitorId) return res.status(400).json({ error: "Invalid team or competitor ID" });

      await viralityService.deleteCompetitor(competitorId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Delete competitor error", error, "Failed to delete competitor");
    }
  }
}

export const viralityController = new ViralityController();
