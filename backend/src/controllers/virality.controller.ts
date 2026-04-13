import { Response } from "express";
import type { ViralityAccount, ViralityPost, ViralityCompetitor, ViralityDashboard, ViralSettings, CompetitorWithAccounts, ViralityPostsByAccount, ErrorResponse, MoveAccountToGroupRequest, MoveAccountToGroupResponse, ViralityAccountListResponse, ViralityAccountResponse, ViralityPostListResponse, ViralityCompetitorListResponse, ViralityCompetitorResponse, SuccessResponse, SyncAcceptedResponse, ViralSettingsResponse, BulkMoveAccountsRequest, BulkMoveAccountsResponse } from "../types/api.types";
import { AuthRequest } from "../middleware/auth.middleware";
import { viralityService } from "../services/virality/virality.service";
import { userPerformanceService } from "../services/virality/userPerformance.service";
import { parseId, parseDateQuery, handleControllerError as handleError, requirePlanAccess as requirePlanAccessBase, verifyTeamAccessOrFail } from "../utils/controllerHelpers";

async function requirePlanAccess(teamId: number, res: Response): Promise<boolean> {
  return requirePlanAccessBase(teamId, res, (id) => viralityService.checkTeamPlanAccess(id), "Virality tracking requires a Studio plan or higher");
}

// ── Controller ───────────────────────────────────────────────────────────────

class ViralityController {
  // ── Competitor Account Controllers ──

  async listAccounts(req: AuthRequest, res: Response<ViralityAccountListResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const accounts = await viralityService.getAccountsByTeam(teamId);
      return res.json({ accounts });
    } catch (error) {
      return handleError(res, "List competitor accounts error", error, "Failed to list competitor accounts");
    }
  }

  async addAccount(req: AuthRequest, res: Response<ViralityAccountResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const { platform, profileUrl, groupId, accountType, competitor } = req.body;

      if (!platform || !profileUrl) {
        return res.status(400).json({ error: "Platform and profile URL are required" });
      }
      if (!["instagram", "tiktok", "x"].includes(platform)) {
        return res.status(400).json({ error: "Only Instagram, TikTok, and X are supported" });
      }
      if (!groupId || isNaN(parseInt(groupId))) {
        return res.status(400).json({ error: "groupId is required" });
      }
      if (typeof competitor !== "boolean") {
        return res.status(400).json({ error: "competitor must be a boolean" });
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
        parseInt(groupId),
        competitor
      );

      const syncService = competitor ? viralityService : userPerformanceService;
      syncService.syncAccount(account.id, teamId).catch((err) => {
        console.error(`Initial sync failed for account ${account.id}:`, err);
      });

      return res.status(201).json({ account });
    } catch (error) {
      return handleError(res, "Add account error", error, "Failed to add account");
    }
  }

  async getAccount(req: AuthRequest, res: Response<ViralityAccountResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      const account = await viralityService.getAccountById(accountId);
      if (!account || account.team_id !== teamId) {
        return res.status(404).json({ error: "Competitor account not found" });
      }

      return res.json({ account });
    } catch (error) {
      return handleError(res, "Get competitor account error", error, "Failed to get competitor account");
    }
  }

  async deleteAccount(req: AuthRequest, res: Response<SuccessResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });

      await viralityService.deleteAccount(accountId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Delete competitor account error", error, "Failed to delete competitor account");
    }
  }

  async updateAccountStatus(req: AuthRequest, res: Response<ViralityAccountResponse | ErrorResponse>) {
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
      return handleError(res, "Update competitor account status error", error, "Failed to update competitor account status");
    }
  }

  async syncAccount(req: AuthRequest, res: Response<SyncAcceptedResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      viralityService.syncAccount(accountId, teamId).catch((err) => {
        console.error(`Background sync failed for competitor account ${accountId}:`, err);
      });

      return res.status(202).json({ accepted: true, accountId });
    } catch (error: any) {
      return handleError(res, "Sync competitor account error", error, "Sync failed: " + error.message);
    }
  }

  // ── Competitor Post Controllers ──

  async getPosts(req: AuthRequest, res: Response<ViralityPostListResponse | ErrorResponse>) {
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
      return handleError(res, "Get competitor posts error", error, "Failed to get competitor posts");
    }
  }

  async deletePost(req: AuthRequest, res: Response<SuccessResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const postId = parseId(req.params.postId);
      if (!teamId || !postId) return res.status(400).json({ error: "Invalid team or post ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      await viralityService.deletePost(postId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Delete competitor post error", error, "Failed to delete competitor post");
    }
  }

  // ── Competitor Dashboard Controller ──

  async getDashboard(req: AuthRequest, res: Response<ViralityDashboard | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const startDate = parseDateQuery(req.query.startDate);
      const endDate = parseDateQuery(req.query.endDate);

      const stats = await viralityService.getDashboardStats(teamId, startDate, endDate);
      return res.json(stats);
    } catch (error) {
      return handleError(res, "Get competitor dashboard error", error, "Failed to get competitor dashboard stats");
    }
  }

  // ── Group Controllers ──

  async listGroups(req: AuthRequest, res: Response<ViralityCompetitorListResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const competitors = await viralityService.getGroupsByTeam(teamId);
      return res.json({ competitors });
    } catch (error) {
      return handleError(res, "List groups error", error, "Failed to list groups");
    }
  }

  async listGroupsWithAccounts(req: AuthRequest, res: Response<ViralityCompetitorListResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const competitors = await viralityService.getAllGroupsWithAccounts(teamId);
      return res.json({ competitors });
    } catch (error) {
      return handleError(res, "List groups with accounts error", error, "Failed to list groups");
    }
  }

  async getAllPosts(req: AuthRequest, res: Response<ViralityPostsByAccount | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const startDate = parseDateQuery(req.query.startDate);
      const endDate = parseDateQuery(req.query.endDate);

      const postsByAccount = await viralityService.getPostsForTeam(teamId, startDate, endDate);
      return res.json({ postsByAccount });
    } catch (error) {
      return handleError(res, "Get all competitor posts error", error, "Failed to get competitor posts");
    }
  }

  async createGroup(req: AuthRequest, res: Response<ViralityCompetitorResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const { name, description, competitor: isCompetitor } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Group name is required" });
      }

      const competitor = await viralityService.createGroup(
        teamId,
        name.trim(),
        description?.trim(),
        isCompetitor !== undefined ? isCompetitor : true,
      );
      return res.status(201).json({ competitor });
    } catch (error) {
      return handleError(res, "Create group error", error, "Failed to create group");
    }
  }

  async updateGroup(req: AuthRequest, res: Response<ViralityCompetitorResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const groupId = parseId(req.params.competitorId);
      if (!teamId || !groupId) return res.status(400).json({ error: "Invalid team or group ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const { name, description } = req.body;
      if (name !== undefined && (!name || !name.trim())) {
        return res.status(400).json({ error: "Group name cannot be empty" });
      }

      const competitor = await viralityService.updateGroup(groupId, teamId, {
        name: name?.trim(),
        description: description?.trim(),
      });
      return res.json({ competitor });
    } catch (error) {
      return handleError(res, "Update group error", error, "Failed to update group");
    }
  }

  async getGroupWithAccounts(req: AuthRequest, res: Response<ViralityCompetitorResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const groupId = parseId(req.params.competitorId);
      if (!teamId || !groupId) return res.status(400).json({ error: "Invalid team or group ID" });

      const competitor = await viralityService.getGroupWithAccounts(groupId, teamId);
      return res.json({ competitor });
    } catch (error) {
      return handleError(res, "Get group error", error, "Failed to get group");
    }
  }

  async deleteGroup(req: AuthRequest, res: Response<SuccessResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const groupId = parseId(req.params.competitorId);
      if (!teamId || !groupId) return res.status(400).json({ error: "Invalid team or group ID" });

      await viralityService.deleteGroup(groupId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Delete group error", error, "Failed to delete group");
    }
  }

  async moveAccountToGroup(req: AuthRequest, res: Response<MoveAccountToGroupResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      const accountId = parseId(req.params.accountId);
      if (!teamId || !accountId) return res.status(400).json({ error: "Invalid team or account ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const { groupId, isCompetitor } = req.body as MoveAccountToGroupRequest;
      if (!groupId || typeof groupId !== "number") {
        return res.status(400).json({ error: "groupId is required" });
      }

      await viralityService.moveAccountToGroup(accountId, teamId, groupId, isCompetitor !== false);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Move account error", error, "Failed to move account");
    }
  }

  async bulkMoveAccounts(req: AuthRequest, res: Response<BulkMoveAccountsResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const { sourceGroupId, targetGroupId } = req.body as BulkMoveAccountsRequest;
      if (!sourceGroupId || !targetGroupId) {
        return res.status(400).json({ error: "sourceGroupId and targetGroupId are required" });
      }

      const moved = await viralityService.bulkMoveAccounts(teamId, sourceGroupId, targetGroupId);
      return res.json({ moved });
    } catch (error) {
      return handleError(res, "Bulk move accounts error", error, "Failed to move accounts");
    }
  }

  // ── Alert Settings Controllers ──

  async updateAlertEnabled(req: AuthRequest, res: Response<ViralityAccountResponse | ErrorResponse>) {
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

  async getSettings(req: AuthRequest, res: Response<ViralSettingsResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const settings = await viralityService.getSettings(teamId);
      return res.json({ settings });
    } catch (error) {
      return handleError(res, "Get settings error", error, "Failed to get viral alert settings");
    }
  }

  async saveSettings(req: AuthRequest, res: Response<ViralSettingsResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
      if (!(await requirePlanAccess(teamId, res))) return;

      const { percentThreshold, absoluteThreshold, thresholdMode, timeFrameHours, enabledAccountIds, additionalEmails } = req.body;

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
      if (additionalEmails !== undefined) {
        if (!Array.isArray(additionalEmails)) {
          return res.status(400).json({ error: "additionalEmails must be an array" });
        }
        if (additionalEmails.length > 10) {
          return res.status(400).json({ error: "Maximum 10 additional emails allowed" });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const email of additionalEmails) {
          if (typeof email !== "string" || !emailRegex.test(email)) {
            return res.status(400).json({ error: `Invalid email: ${email}` });
          }
        }
      }

      const settings = await viralityService.saveSettings(teamId, {
        percentThreshold: percentThreshold ?? null,
        absoluteThreshold: absoluteThreshold ?? null,
        thresholdMode,
        timeFrameHours: timeFrameHours ?? 24,
        enabledAccountIds,
        additionalEmails: additionalEmails ?? [],
      });

      return res.json({ settings });
    } catch (error) {
      return handleError(res, "Save settings error", error, "Failed to save viral alert settings");
    }
  }

  async unpauseAllAccounts(req: AuthRequest, res: Response<SuccessResponse | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      await viralityService.unpauseAllAccountsForTeam(teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleError(res, "Unpause all accounts error", error, "Failed to unpause accounts");
    }
  }

  async getAlertLogs(req: AuthRequest, res: Response<{ logs: any[] } | ErrorResponse>) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;
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
