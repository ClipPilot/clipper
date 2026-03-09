import { Response } from "express";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { eq, and, isNotNull, gt } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth.middleware";
import { userPerformanceService } from "../services/virality/userPerformance.service";
import { config } from "../config/env";
import { parseId, parseDateQuery, handleControllerError, requirePlanAccess as requirePlanAccessBase } from "../utils/controllerHelpers";
import { db } from "../db";
import { userAccounts, userPosts } from "@clipper/shared-db/src/schema";

const sfnClient = new SFNClient({ region: config.aws.region });

async function requirePlanAccess(teamId: number, res: Response): Promise<boolean> {
  return requirePlanAccessBase(teamId, res, (id) => userPerformanceService.checkTeamPlanAccess(id), "Performance tracking requires a Studio plan or higher");
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

  async deletePost(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      const postId = parseId(req.params.postId);
      if (!teamId || !postId) return res.status(400).json({ error: "Invalid team or post ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      await userPerformanceService.deletePost(postId, teamId);
      return res.json({ success: true });
    } catch (error) {
      return handleControllerError(res, "Delete user post error", error, "Failed to delete post");
    }
  }

  async syncAll(req: AuthRequest, res: Response) {
    try {
      const teamId = parseId(req.params.teamId);
      if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
      if (!(await requirePlanAccess(teamId, res))) return;

      const accounts = await userPerformanceService.getAccountsByTeam(teamId) as any[];
      const regularAccounts = accounts.filter((a: any) => a.source !== "mass_posting");

      // Sync regular accounts (full profile scrape)
      const accountResults = await Promise.allSettled(
        regularAccounts.map((a: any) => userPerformanceService.syncAccount(a.id, teamId))
      );
      const accountsFailed = accountResults.filter((r) => r.status === "rejected").length;

      // Count mass posts that will be synced and stamp last_synced_at immediately
      const massPostingAccounts = accounts.filter((a: any) => a.source === "mass_posting");
      let massPostsSynced = 0;

      if (massPostingAccounts.length > 0) {
        for (const acct of massPostingAccounts) {
          const posts = await db
            .select({ id: userPosts.id })
            .from(userPosts)
            .where(
              and(
                eq(userPosts.account_id, acct.id),
                isNotNull(userPosts.mass_post_id),
                gt(userPosts.syncs_remaining, 0)
              )
            );
          massPostsSynced += posts.length;
        }

        if (massPostsSynced > 0) {
          await db
            .update(userAccounts)
            .set({ last_synced_at: new Date(), updated_at: new Date() })
            .where(
              and(
                eq(userAccounts.team_id, teamId),
                eq(userAccounts.source, "mass_posting")
              )
            );
        }
      }

      // Trigger mass post sync via Step Functions (async, isolated in Lambda)
      if (config.aws.viralitySyncSfnArn && massPostsSynced > 0) {
        try {
          await sfnClient.send(new StartExecutionCommand({
            stateMachineArn: config.aws.viralitySyncSfnArn,
            name: `mass-posts-team-${teamId}-${Date.now()}`,
            input: JSON.stringify({ teamId, massPostsOnly: true }),
          }));
          console.log(`[SyncAll] Started Step Functions execution for team ${teamId} mass posts (${massPostsSynced} posts)`);
        } catch (err) {
          console.error(`[SyncAll] Failed to start mass post sync SF execution:`, err);
        }
      }

      return res.json({
        accounts: { synced: regularAccounts.length - accountsFailed, failed: accountsFailed },
        massPosts: { synced: massPostsSynced },
      });
    } catch (error) {
      return handleControllerError(res, "Sync all error", error, "Failed to sync all");
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
