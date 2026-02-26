import { db } from "../db";
import {
  clips,
  posts,
  campaigns,
} from "@clipper/shared-db/src/schema";
import { eq, and, or, sql, desc, asc, ilike, gte, inArray, isNotNull } from "drizzle-orm";
import { teamService } from "./team.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { sqsService } from "./sqs.service";
import { googleDriveService } from "./google/drive.service";
import { s3Service } from "./s3.service";
import { resolveAccountFromUrl } from "../utils/accountResolver";

const VALID_PLATFORMS = new Set(["tiktok", "instagram", "facebook", "youtube", "x"]);

function getDateRangeCutoff(dateRange: string): Date | null {
  if (dateRange === "all") return null;
  if (dateRange === "mtd") {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  const daysMap: Record<string, number> = {
    "7days": 7,
    "30days": 30,
    "3months": 90,
    "90days": 90,
    "1year": 365,
  };
  const days = daysMap[dateRange];
  if (!days) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export type PlatformQuantities = Record<string, number>;

class AdPostingService {
  async validateAndStart(
    teamId: number,
    clipId: number,
    platformQuantities: PlatformQuantities,
    userId: number
  ): Promise<void> {
    for (const [platform, qty] of Object.entries(platformQuantities)) {
      if (!VALID_PLATFORMS.has(platform)) {
        throw new AdPostingError(`Invalid platform: ${platform}`, 400);
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        throw new AdPostingError(
          `Invalid quantity for ${platform}: must be 1-50`,
          400
        );
      }
    }

    const totalCopies = Object.values(platformQuantities).reduce(
      (sum, qty) => sum + qty,
      0
    );

    // Check for any accepted or started campaign for this team
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.team_id, teamId),
          or(
            eq(campaigns.status, "accepted"),
            eq(campaigns.status, "started"),
          )!,
        )
      )
      .limit(1);

    if (!campaign) {
      throw new AdPostingError("Team is not approved for mass posting", 403);
    }

    const driveFolderId = campaign.google_drive_folder_id;
    if (!driveFolderId) {
      throw new AdPostingError("Team does not have a Google Drive folder configured", 403);
    }

    const [clip] = await db
      .select()
      .from(clips)
      .where(and(eq(clips.id, clipId), eq(clips.team_id, teamId)))
      .limit(1);

    if (!clip) {
      throw new AdPostingError("Clip not found", 404);
    }

    if (!clip.clip_path) {
      throw new AdPostingError("Clip has no video file", 400);
    }

    const usage = await getTeamUsage(teamId);
    if (!usage) {
      throw new AdPostingError("Could not retrieve team usage", 500);
    }

    const isCustomUpload = (clip.input_metadata as Record<string, unknown>)?.source === "custom_upload";
    const creditsPerCopy = isCustomUpload ? 2 : 1;
    const creditsNeeded = totalCopies * creditsPerCopy;

    if (usage.totalRemaining < creditsNeeded) {
      throw new AdPostingError(
        `Insufficient credits. Need ${creditsNeeded}, have ${usage.totalRemaining}`,
        402
      );
    }

    await teamService.incrementTeamUsage(teamId, creditsNeeded);

    // Create post rows upfront as "processing" so they appear in the dashboard immediately
    const postIds: Array<{ id: number; platform: string }> = [];
    for (const [platform, qty] of Object.entries(platformQuantities)) {
      for (let i = 0; i < qty; i++) {
        const [row] = await db
          .insert(posts)
          .values({
            team_id: teamId,
            clip_id: clipId,
            content: clip.title || `clip-${clipId}`,
            platform: platform as any,
            status: "processing",
          })
          .returning({ id: posts.id });
        postIds.push({ id: row.id, platform });
      }
    }

    await sqsService.sendAdPostingJob({
      clipId,
      teamId,
      userId,
      platformQuantities,
      driveFolderId,
      clipPath: clip.clip_path,
      clipTitle: clip.title || `clip-${clipId}`,
      postIds,
    });
  }

  async startCampaignPosting(
    campaignId: number,
    clipId: number,
    platformQuantities: PlatformQuantities,
  ): Promise<{ postIds: Array<{ id: number; platform: string }> }> {
    for (const [platform, qty] of Object.entries(platformQuantities)) {
      if (!VALID_PLATFORMS.has(platform)) {
        throw new AdPostingError(`Invalid platform: ${platform}`, 400);
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        throw new AdPostingError(
          `Invalid quantity for ${platform}: must be 1-50`,
          400
        );
      }
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "started")))
      .limit(1);

    if (!campaign) {
      throw new AdPostingError("Campaign not found or not active", 404);
    }

    const driveFolderId = campaign.google_drive_folder_id;
    if (!driveFolderId) {
      throw new AdPostingError(
        "Campaign does not have a Google Drive folder configured",
        400
      );
    }

    const [clip] = await db
      .select()
      .from(clips)
      .where(and(eq(clips.id, clipId), eq(clips.team_id, campaign.team_id)))
      .limit(1);

    if (!clip) {
      throw new AdPostingError("Clip not found", 404);
    }
    if (!clip.clip_path) {
      throw new AdPostingError("Clip has no video file", 400);
    }

    // NO credit deduction — campaign billing is separate

    const postIds: Array<{ id: number; platform: string }> = [];
    for (const [platform, qty] of Object.entries(platformQuantities)) {
      for (let i = 0; i < qty; i++) {
        const [row] = await db
          .insert(posts)
          .values({
            team_id: campaign.team_id,
            clip_id: clipId,
            campaign_id: campaignId,
            content: clip.title || `clip-${clipId}`,
            platform: platform as any,
            status: "processing",
          })
          .returning({ id: posts.id });
        postIds.push({ id: row.id, platform });
      }
    }

    await sqsService.sendAdPostingJob({
      clipId,
      teamId: campaign.team_id,
      userId: 0, // admin-initiated, no specific user
      platformQuantities,
      driveFolderId,
      clipPath: clip.clip_path,
      clipTitle: clip.title || `clip-${clipId}`,
      postIds,
    });

    return { postIds };
  }

  async createCustomVideo(
    teamId: number,
    userId: number,
    fileName: string,
    contentType: string
  ) {
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `custom-uploads/${teamId}/${Date.now()}_${sanitized}`;

    const [clip] = await db
      .insert(clips)
      .values({
        team_id: teamId,
        generated_by_user_id: userId,
        clip_path: s3Key,
        title: fileName.replace(/\.[^.]+$/, ""),
        status: "pending",
        saved: true,
        input_metadata: { source: "custom_upload" },
      })
      .returning();

    const uploadUrl = await s3Service.getPresignedUploadUrlForKey(s3Key, contentType);

    return { clipId: clip.id, uploadUrl, s3Key };
  }

  async completeCustomVideo(teamId: number, clipId: number) {
    const [clip] = await db
      .select({ id: clips.id })
      .from(clips)
      .where(
        and(
          eq(clips.id, clipId),
          eq(clips.team_id, teamId),
          eq(clips.status, "pending")
        )
      )
      .limit(1);

    if (!clip) {
      throw new AdPostingError("Clip not found or already completed", 404);
    }

    await db
      .update(clips)
      .set({ status: "completed", updated_at: new Date() })
      .where(eq(clips.id, clipId));

    return { clipId };
  }

  async markAsPosted(postId: number, postUrl?: string): Promise<void> {
    // Sanitize Instagram /reels/ → /reel/ (scraper only supports /reel/)
    if (postUrl) {
      postUrl = postUrl.replace(/\/reels\//, "/reel/");
    }

    const [post] = await db
      .select({ drive_file_id: posts.drive_file_id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    let accountHandle: string | null = null;
    if (postUrl) {
      try {
        const account = await resolveAccountFromUrl(postUrl);
        accountHandle = account.username;
      } catch (err) {
        console.warn(`[AdPosting] Could not resolve account from ${postUrl}:`, err);
      }
    }

    await db
      .update(posts)
      .set({
        status: "posted",
        post_url: postUrl || null,
        posted_time: new Date(),
        updated_at: new Date(),
        ...(accountHandle && { accountHandle }),
      })
      .where(eq(posts.id, postId));

    if (post?.drive_file_id) {
      try {
        await googleDriveService.deleteFile(post.drive_file_id);
      } catch (err) {
        console.error(`[AdPosting] Drive delete failed for file ${post.drive_file_id}:`, err);
      }
    }
  }

  async getPostsForTeam(
    teamId: number,
    options: {
      tab?: "queued" | "published";
      platform?: string;
      dateRange?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      pageSize?: number;
      campaignId?: number;
    } = {}
  ) {
    const {
      tab = "queued",
      platform,
      dateRange = "all",
      search,
      sortBy = "created_at",
      sortOrder = "desc",
      page = 1,
      pageSize = 20,
      campaignId,
    } = options;

    const conditions = [eq(posts.team_id, teamId)];

    // Campaign filter
    if (campaignId) {
      conditions.push(eq(posts.campaign_id, campaignId));
    }

    // Status group filter
    if (tab === "queued") {
      conditions.push(
        or(
          eq(posts.status, "processing"),
          eq(posts.status, "scheduled"),
          eq(posts.status, "failed")
        )!
      );
    } else {
      conditions.push(eq(posts.status, "posted"));
    }

    // Platform filter
    if (platform) {
      conditions.push(eq(posts.platform, platform as any));
    }

    // Date range filter
    const cutoff = getDateRangeCutoff(dateRange);
    if (cutoff) {
      conditions.push(gte(posts.created_at, cutoff));
    }

    // Search by clip title
    if (search) {
      conditions.push(ilike(clips.title, `%${search}%`));
    }

    const where = and(...conditions);

    const orderCol = sortBy === "posted_time" ? posts.posted_time : posts.created_at;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const selectFields = {
      id: posts.id,
      clip_id: posts.clip_id,
      clip_title: clips.title,
      clip_path: clips.clip_path,
      platform: posts.platform,
      status: posts.status,
      content: posts.content,
      post_url: posts.post_url,
      posted_time: posts.posted_time,
      created_at: posts.created_at,
      accountHandle: posts.accountHandle,
    };

    let rows;
    let totalVideos: number;
    let totalPosts: number;

    if (tab === "queued") {
      // Paginate by unique clip_id (video), then fetch all posts for those clips
      const [countResult] = await db
        .select({
          videos: sql<number>`COUNT(DISTINCT ${posts.clip_id})::int`,
          posts: sql<number>`count(*)::int`,
        })
        .from(posts)
        .leftJoin(clips, eq(posts.clip_id, clips.id))
        .where(where);

      totalVideos = countResult.videos;
      totalPosts = countResult.posts;

      // Get the clip_ids for this page
      const clipPage = await db
        .select({ clip_id: posts.clip_id })
        .from(posts)
        .leftJoin(clips, eq(posts.clip_id, clips.id))
        .where(where)
        .groupBy(posts.clip_id)
        .orderBy(orderFn(sql`min(${orderCol})`))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const clipIds = clipPage.map((r) => r.clip_id).filter((id): id is number => id != null);

      if (clipIds.length === 0) {
        rows = [];
      } else {
        rows = await db
          .select(selectFields)
          .from(posts)
          .leftJoin(clips, eq(posts.clip_id, clips.id))
          .where(and(where, inArray(posts.clip_id, clipIds)))
          .orderBy(orderFn(orderCol));
      }
    } else {
      // Published tab: paginate by individual post
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .leftJoin(clips, eq(posts.clip_id, clips.id))
        .where(where);

      totalVideos = count;
      totalPosts = count;

      rows = await db
        .select(selectFields)
        .from(posts)
        .leftJoin(clips, eq(posts.clip_id, clips.id))
        .where(where)
        .orderBy(orderFn(orderCol))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    }

    // Generate presigned URLs for clip thumbnails
    const postsWithUrls = await Promise.all(
      rows.map(async (row) => {
        let clip_url: string | null = null;
        if (row.clip_path) {
          try {
            clip_url = await s3Service.getPresignedUrl(row.clip_path);
          } catch {
            // S3 URL generation can fail for missing keys
          }
        }
        const { clip_path, ...rest } = row;
        return { ...rest, clip_url };
      })
    );

    return {
      posts: postsWithUrls,
      pagination: {
        page,
        pageSize,
        total: totalVideos,
        totalPages: Math.ceil(totalVideos / pageSize),
        totalPosts,
      },
    };
  }

  async getAccountStats(
    teamId: number,
    options: { dateRange?: string } = {}
  ) {
    const { dateRange = "all" } = options;

    const conditions = [
      eq(posts.team_id, teamId),
      eq(posts.status, "posted"),
      isNotNull(posts.accountHandle),
    ];

    const cutoff = getDateRangeCutoff(dateRange);
    if (cutoff) {
      conditions.push(gte(posts.created_at, cutoff));
    }

    const rows = await db
      .select({
        handle: posts.accountHandle,
        platform: posts.platform,
        totalReposts: sql<number>`count(*)::int`,
      })
      .from(posts)
      .where(and(...conditions))
      .groupBy(posts.accountHandle, posts.platform)
      .orderBy(sql`count(*) DESC`);

    const accounts = rows.map((row, idx) => ({
      id: `${row.handle}-${row.platform}-${idx}`,
      handle: row.handle!,
      platform: row.platform,
      totalReposts: row.totalReposts,
    }));

    const totalAccounts = accounts.length;
    const totalReposts = accounts.reduce((sum, a) => sum + a.totalReposts, 0);
    const avgPostsPerAccount = totalAccounts > 0
      ? Math.round((totalReposts / totalAccounts) * 10) / 10
      : 0;

    return {
      accounts,
      stats: { totalAccounts, totalReposts, avgPostsPerAccount },
    };
  }

  async getPostsForClip(teamId: number, clipId: number) {
    return db
      .select({
        id: posts.id,
        platform: posts.platform,
        status: posts.status,
        post_url: posts.post_url,
        drive_file_id: posts.drive_file_id,
        posted_time: posts.posted_time,
        created_at: posts.created_at,
      })
      .from(posts)
      .where(and(eq(posts.clip_id, clipId), eq(posts.team_id, teamId)));
  }
}

export class AdPostingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AdPostingError";
    this.statusCode = statusCode;
  }
}

export const adPostingService = new AdPostingService();
