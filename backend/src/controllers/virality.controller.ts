import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { viralityService } from "../services/virality/virality.service";
import { parseId, parseDateQuery, handleControllerError as handleError, requirePlanAccess as requirePlanAccessBase } from "../utils/controllerHelpers";

async function requirePlanAccess(teamId: number, res: Response): Promise<boolean> {
  return requirePlanAccessBase(teamId, res, (id) => viralityService.checkTeamPlanAccess(id), "Virality tracking requires a Studio plan or higher");
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
        accountType || "profile",
        competitorId ? parseInt(competitorId) : undefined
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

  async updateAccountStatus(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      const { is_active } = req.body;
      if (typeof is_active !== "boolean") {
        return res.status(400).json({ error: "is_active must be a boolean" });
      }

      const account = await viralityService.updateAccountStatus(accountId, teamId, is_active);
      return res.json({ account });
    } catch (error) {
      return handleError(res, "Update account status error", error, "Failed to update account status");
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

  // ── Alert Settings Controllers ──

  async updateAlertEnabled(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      const { alert_enabled } = req.body;
      if (typeof alert_enabled !== "boolean") {
        return res.status(400).json({ error: "alert_enabled must be a boolean" });
      }

      const account = await viralityService.updateAlertEnabled(accountId, teamId, alert_enabled);
      return res.json({ account });
    } catch (error) {
      return handleError(res, "Update alert enabled error", error, "Failed to update alert setting");
    }
  }

  async getSettings(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const settings = await viralityService.getSettings(teamId);
      return res.json({ settings });
    } catch (error) {
      return handleError(res, "Get settings error", error, "Failed to get viral alert settings");
    }
  }

  async saveSettings(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const { percentThreshold, absoluteThreshold, thresholdMode, timeFrameHours, enabledAccountIds } = req.body;

      if (!["and", "or"].includes(thresholdMode)) {
        return res.status(400).json({ error: "thresholdMode must be 'and' or 'or'" });
      }
      if (!Array.isArray(enabledAccountIds)) {
        return res.status(400).json({ error: "enabledAccountIds must be an array" });
      }
      if (![12, 24, 48].includes(timeFrameHours)) {
        return res.status(400).json({ error: "timeFrameHours must be 12, 24, or 48" });
      }
      if (percentThreshold != null && (typeof percentThreshold !== "number" || percentThreshold <= 0)) {
        return res.status(400).json({ error: "percentThreshold must be a positive number" });
      }
      if (absoluteThreshold != null && (typeof absoluteThreshold !== "number" || absoluteThreshold <= 0)) {
        return res.status(400).json({ error: "absoluteThreshold must be a positive number" });
      }

      const settings = await viralityService.saveSettings(teamId, {
        percentThreshold: percentThreshold ?? null,
        absoluteThreshold: absoluteThreshold ?? null,
        thresholdMode,
        timeFrameHours: timeFrameHours ?? 24,
        enabledAccountIds,
      });

      return res.json({ settings });
    } catch (error) {
      return handleError(res, "Save settings error", error, "Failed to save viral alert settings");
    }
  }

  async getAlertLogs(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await viralityService.getAlertLogs(teamId, limit, offset);
      return res.json({ logs });
    } catch (error) {
      return handleError(res, "Get alert logs error", error, "Failed to get alert logs");
    }
  }
}

export const viralityController = new ViralityController();
