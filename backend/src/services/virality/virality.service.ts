import { db } from "../../db";
import {
  competitorAccounts,
  competitorPosts,
  viralityGroups,
  viralitySettings,
  viralityAlertLogs,
} from "@clipper/shared-db/src/schema";
import { eq, desc, count, and, inArray, gte, lte } from "drizzle-orm";
import { AccountTrackingService } from "./accountTracking.service";

// ── Virality-specific service (adds competitor methods + overrides) ──────────

class ViralityService extends AccountTrackingService {
  constructor() {
    super(competitorAccounts, competitorPosts);
  }

  // Override addAccount to support competitor grouping
  async addAccount(
    teamId: number,
    platform: "instagram" | "tiktok" | "x",
    profileUrl: string,
    accountType: "profile" | "hashtag" | "keyword" = "profile",
    groupId?: number
  ) {
    // Verify competitor ownership if provided
    if (groupId) {
      const competitor = await this.getGroupById(groupId);
      if (!competitor || competitor.team_id !== teamId) {
        throw new Error("Competitor not found or access denied");
      }
    }

    const account = await super.addAccount(teamId, platform, profileUrl, accountType);

    // Set group_id on the created account
    if (groupId) {
      const [updated] = await db
        .update(competitorAccounts)
        .set({ group_id: groupId })
        .where(eq(competitorAccounts.id, account.id))
        .returning();
      return updated;
    }

    return account;
  }

  // Override deleteAccount to handle competitor cleanup
  async deleteAccount(accountId: number, teamId: number) {
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    await db.delete(competitorAccounts).where(eq(competitorAccounts.id, accountId));

    // If the competitor has no remaining accounts, delete it too
    if (account.group_id) {
      const [remaining] = await db
        .select({ count: count() })
        .from(competitorAccounts)
        .where(eq(competitorAccounts.group_id, account.group_id));

      if (remaining.count === 0) {
        await db.delete(viralityGroups).where(eq(viralityGroups.id, account.group_id));
      }
    }
  }

  // Override getPostsByAccount — viralityPosts has no mass_post_id / campaign join
  async getPostsByAccount(
    accountId: number,
    teamId: number,
    limit: number = 20,
    offset: number = 0,
    startDate?: Date,
    endDate?: Date
  ) {
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    const conditions = [eq(competitorPosts.account_id, accountId)];
    if (startDate) conditions.push(gte(competitorPosts.posted_at, startDate));
    if (endDate) conditions.push(lte(competitorPosts.posted_at, endDate));

    const rows = await db
      .select({
        id: competitorPosts.id,
        account_id: competitorPosts.account_id,
        platform_post_id: competitorPosts.platform_post_id,
        post_url: competitorPosts.post_url,
        thumbnail_url: competitorPosts.thumbnail_url,
        caption: competitorPosts.caption,
        hashtags: competitorPosts.hashtags,
        post_type: competitorPosts.post_type,
        posted_at: competitorPosts.posted_at,
        like_count: competitorPosts.like_count,
        comment_count: competitorPosts.comment_count,
        video_view_count: competitorPosts.video_view_count,
        video_play_count: competitorPosts.video_play_count,
        metrics_history: competitorPosts.metrics_history,
        created_at: competitorPosts.created_at,
        updated_at: competitorPosts.updated_at,
      })
      .from(competitorPosts)
      .where(and(...conditions))
      .orderBy(desc(competitorPosts.posted_at))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({ ...r, mass_post_id: null, campaign_name: null }));
  }

  // ── Competitor CRUD ──

  async getGroupsByTeam(teamId: number) {
    return db
      .select()
      .from(viralityGroups)
      .where(eq(viralityGroups.team_id, teamId))
      .orderBy(desc(viralityGroups.created_at));
  }

  async getAllGroupsWithAccounts(teamId: number) {
    const [groups, accounts] = await Promise.all([
      db
        .select()
        .from(viralityGroups)
        .where(eq(viralityGroups.team_id, teamId))
        .orderBy(desc(viralityGroups.created_at)),
      db
        .select()
        .from(competitorAccounts)
        .where(eq(competitorAccounts.team_id, teamId))
        .orderBy(desc(competitorAccounts.created_at)),
    ]);

    const accountsByGroup: Record<number, typeof accounts> = {};
    for (const account of accounts) {
      const gid = account.group_id;
      if (gid) {
        if (!accountsByGroup[gid]) accountsByGroup[gid] = [];
        accountsByGroup[gid].push(account);
      }
    }

    return groups.map((c) => ({
      ...c,
      accounts: accountsByGroup[c.id] || [],
    }));
  }

  async createGroup(teamId: number, name: string, description?: string) {
    const [competitor] = await db
      .insert(viralityGroups)
      .values({
        team_id: teamId,
        name,
        description: description || null,
      })
      .returning();
    return competitor;
  }

  async updateGroup(groupId: number, teamId: number, data: { name?: string; description?: string }) {
    const competitor = await this.getGroupById(groupId);
    if (!competitor || competitor.team_id !== teamId) {
      throw new Error("Competitor not found or access denied");
    }

    const [updated] = await db
      .update(viralityGroups)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updated_at: new Date(),
      })
      .where(eq(viralityGroups.id, groupId))
      .returning();

    return updated;
  }

  async getGroupById(groupId: number) {
    const [competitor] = await db
      .select()
      .from(viralityGroups)
      .where(eq(viralityGroups.id, groupId))
      .limit(1);
    return competitor || null;
  }

  async getGroupWithAccounts(groupId: number, teamId: number) {
    const competitor = await this.getGroupById(groupId);
    if (!competitor || competitor.team_id !== teamId) {
      throw new Error("Group not found or access denied");
    }

    await this.cleanupStaleSyncs();

    const accounts = await db
      .select()
      .from(competitorAccounts)
      .where(eq(competitorAccounts.group_id, groupId))
      .orderBy(desc(competitorAccounts.created_at));

    return { ...competitor, accounts };
  }

  async deleteGroup(groupId: number, teamId: number) {
    const competitor = await this.getGroupById(groupId);
    if (!competitor || competitor.team_id !== teamId) {
      throw new Error("Group not found or access denied");
    }

    await db
      .delete(viralityGroups)
      .where(eq(viralityGroups.id, groupId));
  }

  // ── Viral Alert Settings ──

  async getSettings(teamId: number) {
    const [settingsResult, enabledAccounts] = await Promise.all([
      db
        .select()
        .from(viralitySettings)
        .where(eq(viralitySettings.team_id, teamId))
        .limit(1),
      db
        .select({ id: competitorAccounts.id })
        .from(competitorAccounts)
        .where(
          and(
            eq(competitorAccounts.team_id, teamId),
            eq(competitorAccounts.alert_enabled, true)
          )
        ),
    ]);

    const settings = settingsResult[0];

    return {
      percentThreshold: settings?.percent_threshold ?? 100,
      absoluteThreshold: settings?.absolute_threshold ?? 100000,
      thresholdMode: settings?.threshold_mode ?? "and",
      timeFrameHours: settings?.time_frame_hours ?? 24,
      enabledAccountIds: enabledAccounts.map((a) => a.id),
      additionalEmails: (settings?.additional_emails as string[]) ?? [],
    };
  }

  async saveSettings(
    teamId: number,
    data: {
      percentThreshold: number | null;
      absoluteThreshold: number | null;
      thresholdMode: "and" | "or";
      timeFrameHours: number;
      enabledAccountIds: number[];
      additionalEmails: string[];
    }
  ) {
    const percentThreshold = data.percentThreshold ?? 100;
    const absoluteThreshold = data.absoluteThreshold ?? 100000;

    // Upsert viralitySettings
    const [existing] = await db
      .select({ id: viralitySettings.id })
      .from(viralitySettings)
      .where(eq(viralitySettings.team_id, teamId))
      .limit(1);

    if (existing) {
      await db
        .update(viralitySettings)
        .set({
          percent_threshold: percentThreshold,
          absolute_threshold: absoluteThreshold,
          threshold_mode: data.thresholdMode,
          time_frame_hours: data.timeFrameHours,
          additional_emails: data.additionalEmails,
          updated_at: new Date(),
        })
        .where(eq(viralitySettings.id, existing.id));
    } else {
      await db.insert(viralitySettings).values({
        team_id: teamId,
        percent_threshold: percentThreshold,
        absolute_threshold: absoluteThreshold,
        threshold_mode: data.thresholdMode,
        time_frame_hours: data.timeFrameHours,
        additional_emails: data.additionalEmails,
      });
    }

    // Bulk-update alert_enabled on all team accounts
    await db
      .update(competitorAccounts)
      .set({ alert_enabled: false })
      .where(eq(competitorAccounts.team_id, teamId));

    if (data.enabledAccountIds.length > 0) {
      await db
        .update(competitorAccounts)
        .set({ alert_enabled: true })
        .where(
          and(
            eq(competitorAccounts.team_id, teamId),
            inArray(competitorAccounts.id, data.enabledAccountIds)
          )
        );
    }

    return this.getSettings(teamId);
  }

  async updateAlertEnabled(accountId: number, teamId: number, alertEnabled: boolean) {
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    const [updated] = await db
      .update(competitorAccounts)
      .set({ alert_enabled: alertEnabled, updated_at: new Date() })
      .where(eq(competitorAccounts.id, accountId))
      .returning();

    return updated;
  }

  // ── Alert Logs ──

  async getAlertLogs(teamId: number, limit: number = 20, offset: number = 0) {
    return db
      .select()
      .from(viralityAlertLogs)
      .where(eq(viralityAlertLogs.team_id, teamId))
      .orderBy(desc(viralityAlertLogs.created_at))
      .limit(limit)
      .offset(offset);
  }
}

export const viralityService = new ViralityService();
