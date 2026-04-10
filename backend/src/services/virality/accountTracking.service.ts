import * as Sentry from "@sentry/node";
import { db } from "../../db";
import { teams, posts, campaigns } from "@clipper/shared-db/src/schema";
import { eq, and, or, desc, count, gte, lte, inArray, sql, isNotNull, gt } from "drizzle-orm";
import { getApifyService, InstagramPost, InstagramProfile } from "./apify.service";
import { parseInstagramUsername, parseTikTokUsername, parseXUsername } from "../../utils/parseUsername";
import {
  SCRAPE_WINDOW_DAYS,
  MAX_METRICS_HISTORY,
  MAX_FOLLOWER_HISTORY,
} from "../../config/virality";
import {
  SYNCS_PER_WEEK,
  MASS_POST_SYNC_BUDGET,
} from "../../config/viralitySyncConstants";
import { extractPostIdentifier } from "../../utils/postIdentifier";
import { canAccessViralityTracker, isAnalyticsPlan, getViralityAccountLimit, canTrackKeywords } from "../../utils/plans";
import { teamService } from "../team.service";
import { emitViralitySyncUpdate } from "../socket.service";

const STALE_SYNC_MINUTES = 15;

interface MetricsEntry {
  recorded_at: string;
  likes: number;
  comments: number;
  views: number | null;
}

/**
 * Apply flaky-data protection and strict views monotonicity to scraped metrics.
 *
 * Likes/comments: if Apify returns 0 but we have previous data, use the previous
 * value (flaky scrape). A real non-zero decrease is accepted.
 *
 * Views: strictly monotonic — never decrease. Uses Math.max against previous.
 */
function resolveMetrics(
  incoming: { likes: number; comments: number; views: number | null },
  lastMetric: MetricsEntry | null,
): { likes: number; comments: number; views: number | null } {
  const likes = (!incoming.likes && lastMetric) ? lastMetric.likes : (incoming.likes || 0);
  const comments = (!incoming.comments && lastMetric) ? lastMetric.comments : (incoming.comments || 0);
  const rawViews = incoming.views;
  const views = (rawViews != null && lastMetric?.views != null)
    ? Math.max(rawViews, lastMetric.views)
    : rawViews ?? lastMetric?.views ?? null;
  return { likes, comments, views };
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

    const plan = await this.getTeamPlan(teamId);
    const accountLimit = getViralityAccountLimit(plan);
    if (accountLimit !== -1) {
      const currentCount = await this.getAccountCount(teamId);
      if (currentCount >= accountLimit) {
        throw new Error(`Account limit of ${accountLimit} reached for your plan`);
      }
    }

    if (accountType !== "profile" && !canTrackKeywords(plan)) {
      throw new Error("Hashtag and keyword tracking requires an Analytics Business plan or higher");
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

    const { success } = await this.chargeForAccountCreation(teamId);
    if (!success) {
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

  // ── Plan transition helpers ──

  async deactivateExcessAccounts(teamId: number, newLimit: number): Promise<number> {
    if (newLimit === -1) return 0;

    const activeAccounts = await db
      .select({ id: this.accountsTable.id })
      .from(this.accountsTable)
      .where(
        and(
          eq(this.accountsTable.team_id, teamId),
          eq(this.accountsTable.is_active, true)
        )
      )
      .orderBy(desc(this.accountsTable.created_at)) as any[];

    const toDeactivate = activeAccounts.slice(newLimit);
    if (toDeactivate.length === 0) return 0;

    const ids = toDeactivate.map((a: any) => a.id);
    await db
      .update(this.accountsTable)
      .set({ is_active: false, updated_at: new Date() })
      .where(inArray(this.accountsTable.id, ids));

    console.log(`[PlanTransition] Deactivated ${ids.length} excess accounts for team ${teamId} (limit=${newLimit})`);
    return ids.length;
  }

  async reactivateAllAccounts(teamId: number): Promise<number> {
    const result = await db
      .update(this.accountsTable)
      .set({ is_active: true, updated_at: new Date() })
      .where(
        and(
          eq(this.accountsTable.team_id, teamId),
          eq(this.accountsTable.is_active, false)
        )
      )
      .returning({ id: this.accountsTable.id }) as any[];

    if (result.length > 0) {
      console.log(`[PlanTransition] Reactivated ${result.length} accounts for team ${teamId}`);
    }
    return result.length;
  }

  // ── Credit gating (override to change billing behavior) ──

  protected async getTeamPlan(teamId: number): Promise<string> {
    const [team] = await db
      .select({ plan: teams.plan })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1) as any[];
    return team?.plan || "free";
  }

  protected async chargeForAccountCreation(teamId: number): Promise<{ success: boolean }> {
    const plan = await this.getTeamPlan(teamId);
    if (isAnalyticsPlan(plan)) return { success: true };
    return teamService.consumeClip(teamId);
  }

  protected async consumeSyncCredit(accountId: number, teamId: number): Promise<void> {
    const plan = await this.getTeamPlan(teamId);
    if (isAnalyticsPlan(plan)) return;
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
      const { success: charged } = await teamService.consumeClip(teamId);
      if (charged) {
        await db
          .update(this.accountsTable)
          .set({ syncs_remaining: SYNCS_PER_WEEK - 1, updated_at: new Date() })
          .where(eq(this.accountsTable.id, accountId));
        console.log(`[Credit] Charged 1 credit for account ${accountId} (team=${teamId}), reset syncs_remaining=${SYNCS_PER_WEEK - 1}`);
      } else {
        await db
          .update(this.accountsTable)
          .set({ is_active: false, updated_at: new Date() })
          .where(eq(this.accountsTable.id, accountId));
        throw new Error("No credits available. Account has been deactivated.");
      }
    }
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

    await this.consumeSyncCredit(accountId, teamId);

    // Update status to syncing
    await db
      .update(this.accountsTable)
      .set({
        sync_status: "syncing",
        sync_error: null,
        updated_at: new Date(),
      })
      .where(eq(this.accountsTable.id, accountId));

    emitViralitySyncUpdate(teamId, { accountId, syncStatus: "syncing" });

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

    const canonicalId = (postData.url
      ? extractPostIdentifier(postData.url, platform)
      : null) || postData.id;

    let existingRows = await db
      .select()
      .from(this.postsTable)
      .where(
        and(
          eq(this.postsTable.account_id, accountId),
          eq(this.postsTable.platform_post_id, canonicalId)
        )
      )
      .limit(1) as any[];

    if (existingRows.length === 0 && canonicalId !== postData.id) {
      existingRows = await db
        .select()
        .from(this.postsTable)
        .where(
          and(
            eq(this.postsTable.account_id, accountId),
            eq(this.postsTable.platform_post_id, postData.id)
          )
        )
        .limit(1) as any[];
    }

    const existingPost = existingRows[0];

    if (existingPost) {
      const history: MetricsEntry[] = Array.isArray(existingPost.metrics_history)
        ? [...(existingPost.metrics_history as MetricsEntry[])]
        : [];
      const lastMetric = history.length > 0 ? history[history.length - 1] : null;
      const { likes: newLikes, comments: newComments, views: newViews } = resolveMetrics(
        { likes: postData.likesCount || 0, comments: postData.commentsCount || 0, views: postData.videoPlayCount ?? null },
        lastMetric,
      );

      history.push({ recorded_at: new Date().toISOString(), likes: newLikes, comments: newComments, views: newViews });
      const trimmed = history.length > MAX_METRICS_HISTORY
        ? history.slice(-MAX_METRICS_HISTORY)
        : history;

      await db
        .update(this.postsTable)
        .set({
          like_count: newLikes,
          comment_count: newComments,
          video_play_count: newViews,
          thumbnail_url: postData.displayUrl || existingPost.thumbnail_url,
          metrics_history: trimmed,
          updated_at: new Date(),
        })
        .where(eq(this.postsTable.id, existingPost.id));
    } else {
      const newMetric: MetricsEntry = {
        recorded_at: new Date().toISOString(),
        likes: postData.likesCount || 0,
        comments: postData.commentsCount || 0,
        views: postData.videoPlayCount ?? null,
      };
      await db.insert(this.postsTable).values({
        account_id: accountId,
        platform_post_id: canonicalId,
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

  async createMassPostUserPost(
    accountId: number,
    postId: number,
    postUrl: string,
    platform: string,
    caption: string | null,
    postedAt: Date | null
  ): Promise<{ id: number } | null> {
    const platformPostId = extractPostIdentifier(postUrl, platform);
    if (!platformPostId) return null;

    const existing = await db
      .select({ id: this.postsTable.id })
      .from(this.postsTable)
      .where(
        and(
          eq(this.postsTable.account_id, accountId),
          eq(this.postsTable.platform_post_id, platformPostId)
        )
      )
      .limit(1) as any[];

    if (existing.length > 0) return existing[0];

    const inserted = await db
      .insert(this.postsTable)
      .values({
        account_id: accountId,
        platform_post_id: platformPostId,
        post_url: postUrl,
        caption,
        post_type: "Video",
        posted_at: postedAt,
        like_count: 0,
        comment_count: 0,
        mass_post_id: postId,
        syncs_remaining: MASS_POST_SYNC_BUDGET,
        metrics_history: [],
      })
      .returning({ id: this.postsTable.id }) as any[];

    return inserted[0] ?? null;
  }

  async deletePost(postId: number, teamId: number) {
    const rows = await db
      .select({
        id: this.postsTable.id,
        account_id: this.postsTable.account_id,
      })
      .from(this.postsTable)
      .where(eq(this.postsTable.id, postId))
      .limit(1) as any[];

    const post = rows[0];
    if (!post) throw new Error("Post not found");

    const account = await this.getAccountById(post.account_id);
    if (!account || account.team_id !== teamId) {
      throw new Error("Post not found or access denied");
    }

    await db
      .delete(this.postsTable)
      .where(eq(this.postsTable.id, postId));
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

    const selectFields: Record<string, any> = {
      id: this.postsTable.id,
      account_id: this.postsTable.account_id,
      platform_post_id: this.postsTable.platform_post_id,
      post_url: this.postsTable.post_url,
      thumbnail_url: this.postsTable.thumbnail_url,
      caption: this.postsTable.caption,
      hashtags: this.postsTable.hashtags,
      post_type: this.postsTable.post_type,
      posted_at: this.postsTable.posted_at,
      like_count: this.postsTable.like_count,
      comment_count: this.postsTable.comment_count,
      video_view_count: this.postsTable.video_view_count,
      video_play_count: this.postsTable.video_play_count,
      metrics_history: this.postsTable.metrics_history,
      created_at: this.postsTable.created_at,
      updated_at: this.postsTable.updated_at,
    };

    // mass_post_id + campaign join only exists on userPosts, not viralityPosts
    const hasMassPostId = !!this.postsTable.mass_post_id;
    if (hasMassPostId) {
      selectFields.mass_post_id = this.postsTable.mass_post_id;
      selectFields.campaign_name = campaigns.name;
    }

    let query = db.select(selectFields).from(this.postsTable);

    if (hasMassPostId) {
      query = query
        .leftJoin(posts, eq(this.postsTable.mass_post_id, posts.id))
        .leftJoin(campaigns, eq(posts.campaign_id, campaigns.id)) as any;
    }

    const rows = await query
      .where(and(...conditions))
      .orderBy(desc(this.postsTable.posted_at))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  /**
   * Batch-fetch all posts for a team's accounts in a single query.
   * Returns posts grouped by account_id.
   */
  async getPostsForTeam(
    teamId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<number, any[]>> {
    const accounts = await this.getAccountsByTeam(teamId) as any[];
    const accountIds = accounts.map((a: any) => a.id);
    if (accountIds.length === 0) return {};

    const conditions = [inArray(this.postsTable.account_id, accountIds)];
    if (startDate) conditions.push(gte(this.postsTable.posted_at, startDate));
    if (endDate) conditions.push(lte(this.postsTable.posted_at, endDate));

    const selectFields: Record<string, any> = {
      id: this.postsTable.id,
      account_id: this.postsTable.account_id,
      platform_post_id: this.postsTable.platform_post_id,
      post_url: this.postsTable.post_url,
      thumbnail_url: this.postsTable.thumbnail_url,
      caption: this.postsTable.caption,
      hashtags: this.postsTable.hashtags,
      post_type: this.postsTable.post_type,
      posted_at: this.postsTable.posted_at,
      like_count: this.postsTable.like_count,
      comment_count: this.postsTable.comment_count,
      video_view_count: this.postsTable.video_view_count,
      video_play_count: this.postsTable.video_play_count,
      metrics_history: this.postsTable.metrics_history,
      created_at: this.postsTable.created_at,
      updated_at: this.postsTable.updated_at,
    };

    const hasMassPostId = !!this.postsTable.mass_post_id;
    if (hasMassPostId) {
      selectFields.mass_post_id = this.postsTable.mass_post_id;
      selectFields.campaign_name = campaigns.name;
    }

    let query = db.select(selectFields).from(this.postsTable);

    if (hasMassPostId) {
      query = query
        .leftJoin(posts, eq(this.postsTable.mass_post_id, posts.id))
        .leftJoin(campaigns, eq(posts.campaign_id, campaigns.id)) as any;
    }

    const rows = await query
      .where(and(...conditions))
      .orderBy(desc(this.postsTable.posted_at));

    const grouped: Record<number, any[]> = {};
    for (const row of rows as any[]) {
      const aid = row.account_id;
      if (!grouped[aid]) grouped[aid] = [];
      grouped[aid].push(row);
    }
    return grouped;
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

  /**
   * Sync mass posting posts for a given account in a single batch Apify call.
   * Emits socket events so the frontend can track progress.
   */
  async syncMassPostBatch(accountId: number, teamId: number) {
    // Get eligible posts (have mass_post_id and syncs_remaining > 0)
    const eligiblePosts = await db
      .select({
        id: this.postsTable.id,
        post_url: this.postsTable.post_url,
        metrics_history: this.postsTable.metrics_history,
        like_count: this.postsTable.like_count,
        comment_count: this.postsTable.comment_count,
        video_play_count: this.postsTable.video_play_count,
        thumbnail_url: this.postsTable.thumbnail_url,
      })
      .from(this.postsTable)
      .where(
        and(
          eq(this.postsTable.account_id, accountId),
          isNotNull(this.postsTable.mass_post_id),
          gt(this.postsTable.syncs_remaining, 0)
        )
      );

    if (eligiblePosts.length === 0) return { syncedCount: 0, skippedCount: 0 };

    // Get the account's platform
    const account = await this.getAccountById(accountId);
    if (!account) throw new Error("Account not found");

    emitViralitySyncUpdate(teamId, { accountId, syncStatus: "syncing" });

    try {
      // Decrement syncs_remaining for all eligible posts
      const decremented: { id: number; post_url: string }[] = [];
      for (const p of eligiblePosts) {
        const result = await db
          .update(this.postsTable)
          .set({
            syncs_remaining: sql`${this.postsTable.syncs_remaining} - 1`,
            updated_at: new Date(),
          })
          .where(
            and(
              eq(this.postsTable.id, p.id),
              sql`${this.postsTable.syncs_remaining} > 0`
            )
          )
          .returning({ id: this.postsTable.id }) as any[];

        if (result.length > 0) {
          decremented.push({ id: p.id, post_url: p.post_url });
        }
      }

      if (decremented.length === 0) {
        emitViralitySyncUpdate(teamId, { accountId, syncStatus: "completed" });
        return { syncedCount: 0, skippedCount: eligiblePosts.length };
      }

      // Single batch Apify call for all post URLs
      const apify = getApifyService();
      const postUrls = decremented.map((p) => p.post_url);
      const metricsMap = await apify.scrapeBatchPostMetrics(postUrls, account.platform);

      // Build lookup from the already-fetched eligiblePosts data
      const eligibleMap = new Map(eligiblePosts.map((ep: any) => [ep.id, ep]));

      let syncedCount = 0;
      let skippedCount = 0;

      for (const p of decremented) {
        const postIdentifier = extractPostIdentifier(p.post_url, account.platform);
        const metrics = postIdentifier ? metricsMap.get(postIdentifier) : null;

        if (!metrics) {
          skippedCount++;
          continue;
        }

        const existing = eligibleMap.get(p.id) as any;

        const history: MetricsEntry[] = Array.isArray(existing?.metrics_history)
          ? [...(existing.metrics_history as MetricsEntry[])]
          : [];
        const lastMetric = history.length > 0 ? history[history.length - 1] : null;
        const { likes: newLikes, comments: newComments, views: newViews } = resolveMetrics(
          { likes: metrics.likesCount || 0, comments: metrics.commentsCount || 0, views: metrics.viewCount ?? null },
          lastMetric,
        );

        history.push({ recorded_at: new Date().toISOString(), likes: newLikes, comments: newComments, views: newViews });
        const trimmed = history.length > MAX_METRICS_HISTORY
          ? history.slice(-MAX_METRICS_HISTORY)
          : history;

        await db
          .update(this.postsTable)
          .set({
            like_count: newLikes,
            comment_count: newComments,
            video_play_count: newViews,
            thumbnail_url: metrics.thumbnailUrl || existing?.thumbnail_url || null,
            metrics_history: trimmed,
            updated_at: new Date(),
          })
          .where(eq(this.postsTable.id, p.id));

        syncedCount++;
      }

      // Update account last_synced_at
      await db
        .update(this.accountsTable)
        .set({ last_synced_at: new Date(), updated_at: new Date() })
        .where(eq(this.accountsTable.id, accountId));

      emitViralitySyncUpdate(teamId, { accountId, syncStatus: "completed" });
      return { syncedCount, skippedCount };
    } catch (error: any) {
      console.error(`Mass post batch sync failed for account ${accountId}:`, error);
      Sentry.captureException(error);
      emitViralitySyncUpdate(teamId, { accountId, syncStatus: "failed", syncError: error.message });
      throw error;
    }
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
