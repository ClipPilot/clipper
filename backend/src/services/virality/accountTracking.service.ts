import * as Sentry from "@sentry/node";
import { db } from "../../db";
import { teams } from "@clipper/shared-db/src/schema";
import { eq, and, or, desc, count, gte, lte, inArray, sql } from "drizzle-orm";
import { getApifyService, InstagramPost, InstagramProfile } from "./apify.service";
import { parseInstagramUsername, parseTikTokUsername, parseXUsername } from "../../utils/parseUsername";
import {
  SYNCS_PER_DAY,
  SCRAPE_WINDOW_DAYS,
  MAX_METRICS_HISTORY,
  MAX_FOLLOWER_HISTORY,
} from "../../config/virality";
import { canAccessViralityTracker } from "../../utils/plans";
import { teamService } from "../team.service";
import { emitViralitySyncUpdate } from "../socket.service";

const SYNCS_PER_WEEK = SYNCS_PER_DAY * 7;
const STALE_SYNC_MINUTES = 15;

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

// ── Base class: shared account tracking logic ───────────────────────────────

export class AccountTrackingService {
  protected accountsTable: any;
  protected postsTable: any;

  constructor(accountsTable: any, postsTable: any) {
    this.accountsTable = accountsTable;
    this.postsTable = postsTable;
  }

  // ── Stale sync cleanup ──

  async cleanupStaleSyncs() {
    const cutoff = new Date(Date.now() - STALE_SYNC_MINUTES * 60 * 1000);
    const stale = await db
      .update(this.accountsTable)
      .set({
        sync_status: "failed",
        sync_error: `Sync timed out (stuck for more than ${STALE_SYNC_MINUTES} minutes)`,
        updated_at: new Date(),
      })
      .where(
        and(
          or(
            eq(this.accountsTable.sync_status, "pending"),
            eq(this.accountsTable.sync_status, "syncing")
          ),
          lte(this.accountsTable.updated_at, cutoff)
        )
      )
      .returning({ id: this.accountsTable.id, username: this.accountsTable.username }) as any[];

    if (stale.length > 0) {
      console.log(`[Cleanup] Reset ${stale.length} stale syncs: ${stale.map((s: any) => `@${s.username}`).join(", ")}`);
    }

    return stale;
  }

  // ── Account CRUD ──

  async getAccountsByTeam(teamId: number) {
    return db
      .select()
      .from(this.accountsTable)
      .where(eq(this.accountsTable.team_id, teamId))
      .orderBy(desc(this.accountsTable.created_at));
  }

  async getAccountById(accountId: number) {
    const rows = await db
      .select()
      .from(this.accountsTable)
      .where(eq(this.accountsTable.id, accountId))
      .limit(1) as any[];
    return rows[0] || null;
  }

  async getAccountCount(teamId: number): Promise<number> {
    const rows = await db
      .select({ count: count() })
      .from(this.accountsTable)
      .where(eq(this.accountsTable.team_id, teamId)) as any[];
    return rows[0]?.count || 0;
  }

  async addAccount(
    teamId: number,
    platform: "instagram" | "tiktok" | "x",
    profileUrl: string,
    accountType: "profile" | "hashtag" | "keyword" = "profile"
  ) {
    // Parse username based on account type
    let username: string;
    if (accountType === "profile") {
      username = platform === "tiktok"
        ? parseTikTokUsername(profileUrl)
        : platform === "x"
          ? parseXUsername(profileUrl)
          : parseInstagramUsername(profileUrl);
    } else {
      // Hashtag/keyword: strip # and whitespace, lowercase
      username = profileUrl.trim().replace(/^#/, "").toLowerCase();
    }

    // Check if account already exists
    const existingRows = await db
      .select()
      .from(this.accountsTable)
      .where(
        and(
          eq(this.accountsTable.team_id, teamId),
          eq(this.accountsTable.platform, platform),
          eq(this.accountsTable.username, username)
        )
      )
      .limit(1) as any[];

    if (existingRows[0]) {
      const label = accountType === "hashtag" ? `#${username}` : accountType === "keyword" ? `"${username}"` : `@${username}`;
      throw new Error(`${label} is already being tracked`);
    }

    // Build profile_url based on account type
    let profile_url: string;
    if (accountType === "profile") {
      const profileUrlMap: Record<string, string> = {
        instagram: `https://www.instagram.com/${username}/`,
        tiktok: `https://www.tiktok.com/@${username}`,
        x: `https://x.com/${username}`,
      };
      profile_url = profileUrlMap[platform];
    } else if (accountType === "hashtag") {
      const hashtagUrlMap: Record<string, string> = {
        instagram: `https://www.instagram.com/explore/tags/${username}/`,
        tiktok: `https://www.tiktok.com/tag/${username}`,
        x: `https://x.com/search?q=%23${username}`,
      };
      profile_url = hashtagUrlMap[platform];
    } else {
      // keyword
      const keywordUrlMap: Record<string, string> = {
        instagram: `https://www.instagram.com/explore/tags/${username}/`,
        tiktok: `https://www.tiktok.com/tag/${username}`,
        x: `https://x.com/search?q=${encodeURIComponent(username)}`,
      };
      profile_url = keywordUrlMap[platform];
    }

    const inserted = await db
      .insert(this.accountsTable)
      .values({
        team_id: teamId,
        platform,
        account_type: accountType,
        username,
        profile_url,
        sync_status: "pending",
      })
      .returning() as any[];

    const account = inserted[0];

    // Charge 1 credit immediately on account creation
    const { success } = await teamService.consumeClip(teamId);
    if (!success) {
      // Roll back: delete the just-created account
      await db.delete(this.accountsTable).where(eq(this.accountsTable.id, account.id));
      throw new Error("Insufficient credits to start tracking");
    }

    return account;
  }

  async deleteAccount(accountId: number, teamId: number) {
    // Verify ownership
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    await db.delete(this.accountsTable).where(eq(this.accountsTable.id, accountId));
  }

  async updateAccountStatus(accountId: number, teamId: number, isActive: boolean) {
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    const updated = await db
      .update(this.accountsTable)
      .set({
        is_active: isActive,
        updated_at: new Date(),
      })
      .where(eq(this.accountsTable.id, accountId))
      .returning() as any[];

    return updated[0];
  }

  async syncAccount(accountId: number, teamId: number) {
    // Clean up any stale syncs before starting
    await this.cleanupStaleSyncs();

    // Verify ownership
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    if (!account.is_active) {
      throw new Error("Account is inactive and cannot be synced");
    }

    // Syncs/credits gating — atomic decrement to avoid race conditions
    const decremented = await db
      .update(this.accountsTable)
      .set({
        syncs_remaining: sql`${this.accountsTable.syncs_remaining} - 1`,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(this.accountsTable.id, accountId),
          sql`${this.accountsTable.syncs_remaining} > 0`
        )
      )
      .returning() as any[];

    if (decremented.length === 0) {
      // No syncs remaining — charge a credit and reset
      const { success: charged } = await teamService.consumeClip(teamId);
      if (charged) {
        await db
          .update(this.accountsTable)
          .set({ syncs_remaining: SYNCS_PER_WEEK - 1, updated_at: new Date() })
          .where(eq(this.accountsTable.id, accountId));
        console.log(`[Credit] Charged 1 credit for account ${accountId} (team=${teamId}), reset syncs_remaining=${SYNCS_PER_WEEK - 1}`);
      } else {
        // No credits — deactivate account
        await db
          .update(this.accountsTable)
          .set({ is_active: false, updated_at: new Date() })
          .where(eq(this.accountsTable.id, accountId));
        throw new Error("No credits available. Account has been deactivated.");
      }
    }

    // Update status to syncing
    await db
      .update(this.accountsTable)
      .set({
        sync_status: "syncing",
        sync_error: null,
        updated_at: new Date(),
      })
      .where(eq(this.accountsTable.id, accountId));

    try {
      // Scrape posts using Apify SDK — branch on account_type
      const apify = getApifyService();
      let posts: InstagramPost[];
      let profile: InstagramProfile | null = null;

      if (account.account_type === "hashtag") {
        const result = account.platform === "tiktok"
          ? await apify.scrapeTikTokHashtag(account.username)
          : account.platform === "x"
            ? await apify.scrapeXKeywordSearch(`#${account.username}`)
            : await apify.scrapeInstagramHashtag(account.username);
        posts = result.posts;
      } else if (account.account_type === "keyword") {
        const result = account.platform === "x"
          ? await apify.scrapeXKeywordSearch(account.username)
          : account.platform === "tiktok"
            ? await apify.scrapeTikTokHashtag(account.username)
            : await apify.scrapeInstagramHashtag(account.username);
        posts = result.posts;
      } else {
        const result = account.platform === "tiktok"
          ? await apify.scrapeTikTokPosts(account.username)
          : account.platform === "x"
            ? await apify.scrapeXPosts(account.username)
            : await apify.scrapeInstagramPosts(account.username);
        posts = result.posts;
        profile = result.profile;
      }

      console.log(`Scraped ${posts.length} posts for ${account.account_type === "hashtag" ? "#" : ""}${account.username} (${account.platform}, type=${account.account_type})`);

      // Only update profile for profile-type accounts
      if (account.account_type === "profile") {
        const resolvedProfile = profile
          ?? (account.platform === "instagram"
            ? await apify.scrapeInstagramProfile(account.username)
            : null);

        if (resolvedProfile) {
          await this.updateAccountProfile(accountId, resolvedProfile);
        }

        if (account.platform === "x") {
          const xFollowers = await apify.fetchXFollowerCount(account.username);
          if (xFollowers) {
            await this.updateAccountProfile(accountId, xFollowers);
          }
        }
      }

      // Process and store posts
      for (const postData of posts) {
        await this.upsertPost(accountId, postData, account.platform);
      }

      // Compute total_likes from all posts for this account
      const likesRows = await db
        .select({ total: sql<number>`COALESCE(SUM(${this.postsTable.like_count}), 0)` })
        .from(this.postsTable)
        .where(eq(this.postsTable.account_id, accountId)) as any[];

      // Update sync status + total_likes
      await db
        .update(this.accountsTable)
        .set({
          sync_status: "completed",
          last_synced_at: new Date(),
          total_likes: Number(likesRows[0].total),
          updated_at: new Date(),
        })
        .where(eq(this.accountsTable.id, accountId));

      emitViralitySyncUpdate(teamId, { accountId, syncStatus: "completed" });

      return { success: true, postsProcessed: posts.length };
    } catch (error: any) {
      console.error(`Sync failed for account ${accountId}:`, error);
      Sentry.captureException(error);

      await db
        .update(this.accountsTable)
        .set({
          sync_status: "failed",
          sync_error: error.message || "Unknown error",
          updated_at: new Date(),
        })
        .where(eq(this.accountsTable.id, accountId));

      emitViralitySyncUpdate(teamId, { accountId, syncStatus: "failed", syncError: error.message });

      throw error;
    }
  }

  protected async updateAccountProfile(
    accountId: number,
    profileData: Partial<InstagramProfile>
  ) {
    const existingRows = await db
      .select({ follower_history: this.accountsTable.follower_history })
      .from(this.accountsTable)
      .where(eq(this.accountsTable.id, accountId))
      .limit(1) as any[];

    const existing = existingRows[0];

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

    const updates: Record<string, any> = {
      follower_history: trimmed,
      updated_at: new Date(),
    };
    if (profileData.fullName !== undefined) updates.display_name = profileData.fullName;
    if (profileData.profilePicUrl !== undefined) updates.avatar_url = profileData.profilePicUrl;
    if (profileData.biography !== undefined) updates.bio = profileData.biography;
    if (profileData.followersCount !== undefined) updates.follower_count = profileData.followersCount;
    if (profileData.followsCount !== undefined) updates.following_count = profileData.followsCount;
    if (profileData.postsCount !== undefined) updates.post_count = profileData.postsCount;
    if (profileData.isVerified !== undefined) updates.is_verified = profileData.isVerified;

    await db
      .update(this.accountsTable)
      .set(updates)
      .where(eq(this.accountsTable.id, accountId));
  }

  protected async upsertPost(
    accountId: number,
    postData: Partial<InstagramPost>,
    platform: string
  ) {
    if (!postData.id) return;

    if (postData.timestamp) {
      const postDate = new Date(postData.timestamp);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - SCRAPE_WINDOW_DAYS);
      if (postDate < cutoff) return;
    }

    const existingRows = await db
      .select()
      .from(this.postsTable)
      .where(
        and(
          eq(this.postsTable.account_id, accountId),
          eq(this.postsTable.platform_post_id, postData.id)
        )
      )
      .limit(1) as any[];

    const existingPost = existingRows[0];

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
        .update(this.postsTable)
        .set({
          like_count: postData.likesCount || 0,
          comment_count: postData.commentsCount || 0,
          video_play_count: postData.videoPlayCount,
          thumbnail_url: postData.displayUrl || existingPost.thumbnail_url,
          metrics_history: trimmed,
          updated_at: new Date(),
        })
        .where(eq(this.postsTable.id, existingPost.id));
    } else {
      await db.insert(this.postsTable).values({
        account_id: accountId,
        platform_post_id: postData.id,
        post_url: postData.url || (platform === "x"
          ? `https://x.com/i/status/${postData.id}`
          : platform === "tiktok"
            ? postData.url || ""
            : `https://www.instagram.com/p/${postData.shortCode}/`),
        thumbnail_url: postData.displayUrl || null,
        caption: postData.caption,
        hashtags: postData.hashtags || [],
        post_type: postData.type,
        posted_at: postData.timestamp ? new Date(postData.timestamp) : null,
        like_count: postData.likesCount || 0,
        comment_count: postData.commentsCount || 0,
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
    const account = await this.getAccountById(accountId);
    if (!account || account.team_id !== teamId) {
      throw new Error("Account not found or access denied");
    }

    const conditions = [eq(this.postsTable.account_id, accountId)];
    if (startDate) conditions.push(gte(this.postsTable.posted_at, startDate));
    if (endDate) conditions.push(lte(this.postsTable.posted_at, endDate));

    return db
      .select()
      .from(this.postsTable)
      .where(and(...conditions))
      .orderBy(desc(this.postsTable.posted_at))
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

    const conditions = [inArray(this.postsTable.account_id, accountIds)];
    if (startDate) conditions.push(gte(this.postsTable.posted_at, startDate));
    if (endDate) conditions.push(lte(this.postsTable.posted_at, endDate));

    const rows = await db
      .select({
        totalLikes: sql<number>`COALESCE(SUM(${this.postsTable.like_count}), 0)`,
        totalComments: sql<number>`COALESCE(SUM(${this.postsTable.comment_count}), 0)`,
        totalViews: sql<number>`COALESCE(SUM(${this.postsTable.video_play_count}), 0)`,
        postCount: count(),
      })
      .from(this.postsTable)
      .where(and(...conditions)) as any[];

    const result = rows[0];

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

    const conditions = [inArray(this.postsTable.account_id, accountIds)];
    if (startDate) conditions.push(gte(this.postsTable.posted_at, startDate));
    if (endDate) conditions.push(lte(this.postsTable.posted_at, endDate));

    const rows = await db
      .select({
        accountId: this.postsTable.account_id,
        totalViews: sql<number>`COALESCE(SUM(${this.postsTable.video_play_count}), 0)`,
        postCount: count(),
      })
      .from(this.postsTable)
      .where(and(...conditions))
      .groupBy(this.postsTable.account_id) as any[];

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
    const accounts = await this.getAccountsByTeam(teamId) as any[];
    const accountIds = accounts.map((a: any) => a.id);

    let totalFollowers = 0;
    for (const account of accounts) {
      if (account.account_type === "profile") {
        totalFollowers += account.follower_count || 0;
      }
    }

    const hasDateFilter = !!(startDate || endDate);

    let totalLikes: number;
    let totalPosts: number;
    let totalViews: number;
    let avgViewsPerPost: number;

    if (hasDateFilter) {
      const postsStats = await this.getPostsStatsByAccounts(accountIds, startDate, endDate);
      totalLikes = postsStats.totalLikes;
      totalPosts = postsStats.postCount;
      totalViews = postsStats.totalViews;
      avgViewsPerPost = postsStats.postCount > 0
        ? Math.round(postsStats.totalViews / postsStats.postCount)
        : 0;
    } else {
      totalLikes = 0;
      totalPosts = 0;
      for (const account of accounts) {
        totalLikes += account.total_likes || 0;
        totalPosts += account.post_count || 0;
      }
      const postsStats = await this.getPostsStatsByAccounts(accountIds);
      totalViews = postsStats.totalViews;
      avgViewsPerPost = postsStats.postCount > 0
        ? Math.round(postsStats.totalViews / postsStats.postCount)
        : 0;
    }

    const accountPostStats = await this.getPostsStatsByAccount(accountIds, startDate, endDate);

    return {
      accountsCount: accounts.length,
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

    return canAccessViralityTracker(team.plan);
  }
}
