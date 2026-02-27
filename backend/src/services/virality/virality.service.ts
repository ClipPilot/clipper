import { db } from "../../db";
import {
  viralityAccounts,
  viralityPosts,
  viralityCompetitors,
  viralitySettings,
  viralityAlertLogs,
} from "@clipper/shared-db/src/schema";
import { eq, desc, count, and, inArray, not } from "drizzle-orm";
import { AccountTrackingService } from "./accountTracking.service";

// ── Virality-specific service (adds competitor methods + overrides) ──────────

class ViralityService extends AccountTrackingService {
  constructor() {
    super(viralityAccounts, viralityPosts);
  }

  // Override addAccount to support competitor grouping
  async addAccount(
    teamId: number,
    platform: "instagram" | "tiktok" | "x",
    profileUrl: string,
    accountType: "profile" | "hashtag" | "keyword" = "profile",
    competitorId?: number
  ) {
    // Verify competitor ownership if provided
    if (competitorId) {
      const competitor = await this.getCompetitorById(competitorId);
      if (!competitor || competitor.team_id !== teamId) {
        throw new Error("Competitor not found or access denied");
      }
    }

    const account = await super.addAccount(teamId, platform, profileUrl, accountType);

    // Set competitor_id on the created account
    if (competitorId) {
      const [updated] = await db
        .update(viralityAccounts)
        .set({ competitor_id: competitorId })
        .where(eq(viralityAccounts.id, account.id))
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

    await db.delete(viralityAccounts).where(eq(viralityAccounts.id, accountId));

    // If the competitor has no remaining accounts, delete it too
    if (account.competitor_id) {
      const [remaining] = await db
        .select({ count: count() })
        .from(viralityAccounts)
        .where(eq(viralityAccounts.competitor_id, account.competitor_id));

      if (remaining.count === 0) {
        await db.delete(viralityCompetitors).where(eq(viralityCompetitors.id, account.competitor_id));
      }
    }
  }

  // ── Competitor CRUD ──

  async getCompetitorsByTeam(teamId: number) {
    return db
      .select()
      .from(viralityCompetitors)
      .where(eq(viralityCompetitors.team_id, teamId))
      .orderBy(desc(viralityCompetitors.created_at));
  }

  async createCompetitor(teamId: number, name: string, description?: string) {
    const [competitor] = await db
      .insert(viralityCompetitors)
      .values({
        team_id: teamId,
        name,
        description: description || null,
      })
      .returning();
    return competitor;
  }

  async updateCompetitor(competitorId: number, teamId: number, data: { name?: string; description?: string }) {
    const competitor = await this.getCompetitorById(competitorId);
    if (!competitor || competitor.team_id !== teamId) {
      throw new Error("Competitor not found or access denied");
    }

    const [updated] = await db
      .update(viralityCompetitors)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updated_at: new Date(),
      })
      .where(eq(viralityCompetitors.id, competitorId))
      .returning();

    return updated;
  }

  async getCompetitorById(competitorId: number) {
    const [competitor] = await db
      .select()
      .from(viralityCompetitors)
      .where(eq(viralityCompetitors.id, competitorId))
      .limit(1);
    return competitor || null;
  }

  async getCompetitorWithAccounts(competitorId: number, teamId: number) {
    const competitor = await this.getCompetitorById(competitorId);
    if (!competitor || competitor.team_id !== teamId) {
      throw new Error("Competitor not found or access denied");
    }

    await this.cleanupStaleSyncs();

    const accounts = await db
      .select()
      .from(viralityAccounts)
      .where(eq(viralityAccounts.competitor_id, competitorId))
      .orderBy(desc(viralityAccounts.created_at));

    return { ...competitor, accounts };
  }

  async deleteCompetitor(competitorId: number, teamId: number) {
    const competitor = await this.getCompetitorById(competitorId);
    if (!competitor || competitor.team_id !== teamId) {
      throw new Error("Competitor not found or access denied");
    }

    await db
      .delete(viralityCompetitors)
      .where(eq(viralityCompetitors.id, competitorId));
  }

  // ── Viral Alert Settings ──

  async getSettings(teamId: number) {
    const [settings] = await db
      .select()
      .from(viralitySettings)
      .where(eq(viralitySettings.team_id, teamId))
      .limit(1);

    const enabledAccounts = await db
      .select({ id: viralityAccounts.id })
      .from(viralityAccounts)
      .where(
        and(
          eq(viralityAccounts.team_id, teamId),
          eq(viralityAccounts.alert_enabled, true)
        )
      );

    return {
      percentThreshold: settings?.percent_threshold ?? 100,
      absoluteThreshold: settings?.absolute_threshold ?? 100000,
      thresholdMode: settings?.threshold_mode ?? "and",
      timeFrameHours: settings?.time_frame_hours ?? 24,
      enabledAccountIds: enabledAccounts.map((a) => a.id),
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
    }
  ) {
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
          percent_threshold: data.percentThreshold,
          absolute_threshold: data.absoluteThreshold,
          threshold_mode: data.thresholdMode,
          time_frame_hours: data.timeFrameHours,
          updated_at: new Date(),
        })
        .where(eq(viralitySettings.id, existing.id));
    } else {
      await db.insert(viralitySettings).values({
        team_id: teamId,
        percent_threshold: data.percentThreshold,
        absolute_threshold: data.absoluteThreshold,
        threshold_mode: data.thresholdMode,
        time_frame_hours: data.timeFrameHours,
      });
    }

    // Bulk-update alert_enabled on all team accounts
    // First disable all
    await db
      .update(viralityAccounts)
      .set({ alert_enabled: false })
      .where(eq(viralityAccounts.team_id, teamId));

    // Then enable selected ones
    if (data.enabledAccountIds.length > 0) {
      await db
        .update(viralityAccounts)
        .set({ alert_enabled: true })
        .where(
          and(
            eq(viralityAccounts.team_id, teamId),
            inArray(viralityAccounts.id, data.enabledAccountIds)
          )
        );
    }

    return this.getSettings(teamId);
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
