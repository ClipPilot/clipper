import * as Sentry from "@sentry/node";
import { db } from "../../db";
import {
  viralityAccounts,
  viralityPosts,
  viralityCompetitors,
  teams,
} from "@clipper/shared-db/src/schema";
import { eq, and, desc, count, gte, lte, inArray, sql } from "drizzle-orm";
import { apifyService, InstagramPost, InstagramProfile } from "./apify.service";

const MAX_ACCOUNTS_PER_TEAM = 10;
const SYNC_INTERVAL = 6 // every 6 hours
const SYNCS_PER_DAY = Math.floor(24 / SYNC_INTERVAL)
const MAX_METRICS_HISTORY = 28 * SYNCS_PER_DAY;
const MAX_FOLLOWER_HISTORY = 180; // ~6 months of daily syncs

interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

interface FollowerEntry {
  recorded_at: string;
  followers: number;
}

class ViralityService {
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

  // ── Account CRUD ──

  async getAccountsByTeam(teamId: number) {
    return db
      .select()
      .from(viralityAccounts)
      .where(eq(viralityAccounts.team_id, teamId))
      .orderBy(desc(viralityAccounts.created_at));
  }

  async getAccountById(accountId: number) {
    const [account] = await db
      .select()
      .from(viralityAccounts)
      .where(eq(viralityAccounts.id, accountId))
      .limit(1);
    return account || null;
  }

  async getAccountCount(teamId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(viralityAccounts)
      .where(eq(viralityAccounts.team_id, teamId));
    return result?.count || 0;
  }

  async addAccount(teamId: number, platform: "instagram" | "tiktok" | "x", profileUrl: string, competitorId?: number) {
    // Check account limit
    const currentCount = await this.getAccountCount(teamId);
    if (currentCount >= MAX_ACCOUNTS_PER_TEAM) {
      throw new Error(
        `Maximum of ${MAX_ACCOUNTS_PER_TEAM} accounts per team reached`
      );
    }

    const username = platform === "tiktok"
      ? apifyService.parseTikTokUsername(profileUrl)
      : platform === "x"
        ? apifyService.parseXUsername(profileUrl)
        : apifyService.parseInstagramUsername(profileUrl);

    // Check if account already exists
    const [existing] = await db
      .select()
      .from(viralityAccounts)
      .where(
        and(
          eq(viralityAccounts.team_id, teamId),
          eq(viralityAccounts.platform, platform),
          eq(viralityAccounts.username, username)
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(`Account @${username} is already being tracked`);
    }

    // Verify competitor ownership if provided
    if (competitorId) {
      const competitor = await this.getCompetitorById(competitorId);
      if (!competitor || competitor.team_id !== teamId) {
        throw new Error("Competitor not found or access denied");
      }
    }

    const profileUrlMap: Record<string, string> = {
      instagram: `https://www.instagram.com/${username}/`,
      tiktok: `https://www.tiktok.com/@${username}`,
      x: `https://x.com/${username}`,
    };

    const [account] = await db
      .insert(viralityAccounts)
      .values({
        team_id: teamId,
        platform,
        username,
        profile_url: profileUrlMap[platform],
        sync_status: "pending",
        competitor_id: competitorId || null,
      })
      .returning();

    return account;
  }

  async deleteAccount(accountId: number, teamId: number) {
    // Verify ownership
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    await db.delete(viralityAccounts).where(eq(viralityAccounts.id, accountId));
  }

  async syncAccount(accountId: number, teamId: number) {
    // Verify ownership
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    // Update status to syncing
    await db
      .update(viralityAccounts)
      .set({
        sync_status: "syncing",
        sync_error: null,
        updated_at: new Date(),
      })
      .where(eq(viralityAccounts.id, accountId));

    try {
      // Scrape posts using Apify SDK
      const { posts, profile } = account.platform === "tiktok"
        ? await apifyService.scrapeTikTokPosts(account.username)
        : account.platform === "x"
          ? await apifyService.scrapeXPosts(account.username)
          : await apifyService.scrapeInstagramPosts(account.username);
      console.log(`Scraped ${posts.length} posts for @${account.username} (${account.platform})`);

      // Fallback: fetch profile separately if posts scrape didn't include it (Instagram only)
      const resolvedProfile = profile
        ?? (account.platform === "instagram"
          ? await apifyService.scrapeInstagramProfile(account.username)
          : null);

      // Update profile info if available
      if (resolvedProfile) {
        await this.updateAccountProfile(accountId, resolvedProfile);
      }

      // Process and store posts
      for (const postData of posts) {
        await this.upsertPost(accountId, postData, account.platform);
      }

      // Compute total_likes from all posts for this account
      const [likesResult] = await db
        .select({ total: sql<number>`COALESCE(SUM(${viralityPosts.like_count}), 0)` })
        .from(viralityPosts)
        .where(eq(viralityPosts.account_id, accountId));

      // Update sync status + total_likes
      await db
        .update(viralityAccounts)
        .set({
          sync_status: "completed",
          last_synced_at: new Date(),
          total_likes: Number(likesResult.total),
          updated_at: new Date(),
        })
        .where(eq(viralityAccounts.id, accountId));

      return { success: true, postsProcessed: posts.length };
    } catch (error: any) {
      console.error(`Sync failed for account ${accountId}:`, error);
      Sentry.captureException(error);

      await db
        .update(viralityAccounts)
        .set({
          sync_status: "failed",
          sync_error: error.message || "Unknown error",
          updated_at: new Date(),
        })
        .where(eq(viralityAccounts.id, accountId));

      throw error;
    }
  }

  private async updateAccountProfile(
    accountId: number,
    profileData: Partial<InstagramProfile>
  ) {
    // Fetch existing account to get current follower_history
    const [existing] = await db
      .select({ follower_history: viralityAccounts.follower_history })
      .from(viralityAccounts)
      .where(eq(viralityAccounts.id, accountId))
      .limit(1);

    // Append to follower_history
    const history: FollowerEntry[] = Array.isArray(existing?.follower_history)
      ? [...(existing.follower_history as FollowerEntry[])]
      : [];

    if (profileData.followersCount != null) {
      history.push({
        recorded_at: new Date().toISOString(),
        followers: profileData.followersCount,
      });
    }

    const trimmed = history.length > MAX_FOLLOWER_HISTORY
      ? history.slice(-MAX_FOLLOWER_HISTORY)
      : history;

    await db
      .update(viralityAccounts)
      .set({
        display_name: profileData.fullName,
        avatar_url: profileData.profilePicUrl,
        bio: profileData.biography,
        follower_count: profileData.followersCount,
        following_count: profileData.followsCount,
        post_count: profileData.postsCount,
        follower_history: trimmed,
        is_verified: profileData.isVerified || false,
        updated_at: new Date(),
      })
      .where(eq(viralityAccounts.id, accountId));
  }

  private async upsertPost(
    accountId: number,
    postData: Partial<InstagramPost>,
    platform: string
  ) {
    if (!postData.id) return;

    const [existingPost] = await db
      .select()
      .from(viralityPosts)
      .where(
        and(
          eq(viralityPosts.account_id, accountId),
          eq(viralityPosts.platform_post_id, postData.id)
        )
      )
      .limit(1);

    const newMetric: MetricsEntry = {
      recorded_at: new Date().toISOString(),
      likes: postData.likesCount || 0,
      comments: postData.commentsCount || 0,
      views: postData.videoPlayCount ?? null,
    };

    if (existingPost) {
      const history: MetricsEntry[] = Array.isArray(existingPost.metrics_history)
        ? [...(existingPost.metrics_history as MetricsEntry[])]
        : [];
      history.push(newMetric);
      const trimmed = history.length > MAX_METRICS_HISTORY
        ? history.slice(-MAX_METRICS_HISTORY)
        : history;

      await db
        .update(viralityPosts)
        .set({
          like_count: postData.likesCount || 0,
          comment_count: postData.commentsCount || 0,
          video_view_count: postData.videoPlayCount,
          video_play_count: postData.videoPlayCount,
          metrics_history: trimmed,
          updated_at: new Date(),
        })
        .where(eq(viralityPosts.id, existingPost.id));
    } else {
      await db.insert(viralityPosts).values({
        account_id: accountId,
        platform_post_id: postData.id,
        post_url: postData.url || (platform === "x"
          ? `https://x.com/i/status/${postData.id}`
          : `https://www.instagram.com/p/${postData.shortCode}/`),
        thumbnail_url: platform === "tiktok" ? postData.displayUrl : null,
        caption: postData.caption,
        hashtags: postData.hashtags || [],
        post_type: postData.type,
        posted_at: postData.timestamp ? new Date(postData.timestamp) : null,
        like_count: postData.likesCount || 0,
        comment_count: postData.commentsCount || 0,
        video_view_count: postData.videoPlayCount,
        video_play_count: postData.videoPlayCount,
        metrics_history: [newMetric],
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  async getPostsByAccount(
    accountId: number,
    teamId: number,
    limit: number = 20,
    offset: number = 0,
    startDate?: Date,
    endDate?: Date
  ) {
    // Verify ownership
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    const conditions = [eq(viralityPosts.account_id, accountId)];
    if (startDate) conditions.push(gte(viralityPosts.posted_at, startDate));
    if (endDate) conditions.push(lte(viralityPosts.posted_at, endDate));

    return db
      .select()
      .from(viralityPosts)
      .where(and(...conditions))
      .orderBy(desc(viralityPosts.posted_at))
      .limit(limit)
      .offset(offset);
  }

  async getPostsStatsByAccounts(
    accountIds: number[],
    startDate?: Date,
    endDate?: Date
  ) {
    if (accountIds.length === 0) {
      return { totalLikes: 0, totalComments: 0, totalViews: 0, postCount: 0 };
    }

    const conditions = [inArray(viralityPosts.account_id, accountIds)];
    if (startDate) conditions.push(gte(viralityPosts.posted_at, startDate));
    if (endDate) conditions.push(lte(viralityPosts.posted_at, endDate));

    const [result] = await db
      .select({
        totalLikes: sql<number>`COALESCE(SUM(${viralityPosts.like_count}), 0)`,
        totalComments: sql<number>`COALESCE(SUM(${viralityPosts.comment_count}), 0)`,
        totalViews: sql<number>`COALESCE(SUM(${viralityPosts.video_view_count}), 0)`,
        postCount: count(),
      })
      .from(viralityPosts)
      .where(and(...conditions));

    return {
      totalLikes: Number(result.totalLikes),
      totalComments: Number(result.totalComments),
      totalViews: Number(result.totalViews),
      postCount: Number(result.postCount),
    };
  }

  async getPostsStatsByAccount(
    accountIds: number[],
    startDate?: Date,
    endDate?: Date
  ) {
    if (accountIds.length === 0) return {};

    const conditions = [inArray(viralityPosts.account_id, accountIds)];
    if (startDate) conditions.push(gte(viralityPosts.posted_at, startDate));
    if (endDate) conditions.push(lte(viralityPosts.posted_at, endDate));

    const rows = await db
      .select({
        accountId: viralityPosts.account_id,
        totalViews: sql<number>`COALESCE(SUM(${viralityPosts.video_view_count}), 0)`,
        postCount: count(),
      })
      .from(viralityPosts)
      .where(and(...conditions))
      .groupBy(viralityPosts.account_id);

    const stats: Record<number, { totalViews: number; postCount: number }> = {};
    for (const row of rows) {
      stats[row.accountId] = {
        totalViews: Number(row.totalViews),
        postCount: Number(row.postCount),
      };
    }
    return stats;
  }

  async getDashboardStats(teamId: number, startDate?: Date, endDate?: Date) {
    const accounts = await this.getAccountsByTeam(teamId);
    const accountIds = accounts.map((a) => a.id);

    let totalFollowers = 0;
    for (const account of accounts) {
      totalFollowers += account.follower_count || 0;
    }

    const hasDateFilter = !!(startDate || endDate);

    let totalLikes: number;
    let totalPosts: number;
    let totalViews: number;
    let avgViewsPerPost: number;

    if (hasDateFilter) {
      // Use post-level aggregation filtered by date
      const postsStats = await this.getPostsStatsByAccounts(accountIds, startDate, endDate);
      totalLikes = postsStats.totalLikes;
      totalPosts = postsStats.postCount;
      totalViews = postsStats.totalViews;
      avgViewsPerPost = postsStats.postCount > 0
        ? Math.round(postsStats.totalViews / postsStats.postCount)
        : 0;
    } else {
      // Use profile-level stats for likes/posts (backward compatible)
      totalLikes = 0;
      totalPosts = 0;
      for (const account of accounts) {
        totalLikes += account.total_likes || 0;
        totalPosts += account.post_count || 0;
      }
      // Views must come from posts table (not stored on accounts)
      const postsStats = await this.getPostsStatsByAccounts(accountIds);
      totalViews = postsStats.totalViews;
      avgViewsPerPost = postsStats.postCount > 0
        ? Math.round(postsStats.totalViews / postsStats.postCount)
        : 0;
    }

    // Per-account post stats for the AccountsTable
    const accountPostStats = await this.getPostsStatsByAccount(accountIds, startDate, endDate);

    return {
      accountsCount: accounts.length,
      maxAccounts: MAX_ACCOUNTS_PER_TEAM,
      totalFollowers,
      totalLikes,
      totalPosts,
      totalViews,
      avgViewsPerPost,
      accountPostStats,
      accounts,
    };
  }

  async checkTeamPlanAccess(teamId: number): Promise<boolean> {
    const [team] = await db
      .select({ plan: teams.plan })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) return false;

    // Studio+ plans only
    const allowedPlans = ["studio", "scale", "enterprise"];
    return allowedPlans.includes(team.plan);
  }
}

export const viralityService = new ViralityService();
