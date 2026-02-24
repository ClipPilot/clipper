import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { userPerformanceService } from "../services/virality/virality.service";
import { parseId, parseDateQuery, handleControllerError } from "../utils/controllerHelpers";

const PLAN_REQUIRED_RESPONSE = {
  error: "Performance tracking requires a Studio plan or higher",
  code: "PLAN_REQUIRED",
} as const;

async function requirePlanAccess(teamId: number, res: Response): Promise<boolean> {
  const hasAccess = await userPerformanceService.checkTeamPlanAccess(teamId);
  if (!hasAccess) {
    res.status(403).json(PLAN_REQUIRED_RESPONSE);
    return false;
  }
  return true;
}

// ── Controller ───────────────────────────────────────────────────────────────

class UserPerformanceController {
  async listAccounts(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const accounts = await userPerformanceService.getAccountsByTeam(teamId);
      return res.json({ accounts });
    } catch (error) {
      return handleControllerError(res, "List user accounts error", error, "Failed to list accounts");
    }
  }

  async addAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const { platform, profileUrl, accountType } = req.body;

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

      const account = await userPerformanceService.addAccount(
        teamId,
        platform,
        profileUrl,
        accountType || "profile"
      );

      // Trigger first sync in the background
      userPerformanceService.syncAccount(account.id, teamId).catch((err) => {
        console.error(`Initial sync failed for user account ${account.id}:`, err);
      });

      return res.status(201).json({ account });
    } catch (error) {
      return handleControllerError(res, "Add user account error", error, "Failed to add account");
    }
  }

  async getAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const account = await userPerformanceService.getAccountById(accountId);
      if (!account || account.team_id !== teamId) {
        return res.status(404).json({ error: "Account not found" });
      }

      return res.json({ account });
    } catch (error) {
      return handleControllerError(res, "Get user account error", error, "Failed to get account");
    }
  }

  async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      await userPerformanceService.deleteAccount(accountId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleControllerError(res, "Delete user account error", error, "Failed to delete account");
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

      const account = await userPerformanceService.updateAccountStatus(accountId, teamId, is_active);
      return res.json({ account });
    } catch (error) {
      return handleControllerError(res, "Update user account status error", error, "Failed to update account status");
    }
  }

  async syncAccount(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const result = await userPerformanceService.syncAccount(accountId, teamId);
      return res.json(result);
    } catch (error: any) {
      return handleControllerError(res, "Sync user account error", error, "Sync failed: " + error.message);
    }
  }

  async getPosts(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = parseDateQuery(req.query.startDate);
      const endDate = parseDateQuery(req.query.endDate);

      const posts = await userPerformanceService.getPostsByAccount(
        accountId,
        teamId,
        Math.min(limit, 100),
        offset,
        startDate,
        endDate
      );
      return res.json({ posts });
    } catch (error) {
      return handleControllerError(res, "Get user posts error", error, "Failed to get posts");
    }
  }

  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const startDate = parseDateQuery(req.query.startDate);
      const endDate = parseDateQuery(req.query.endDate);

      const stats = await userPerformanceService.getDashboardStats(teamId, startDate, endDate);
      return res.json(stats);
    } catch (error) {
      return handleControllerError(res, "Get user performance dashboard error", error, "Failed to get dashboard stats");
    }
  }
}

export const userPerformanceController = new UserPerformanceController();
