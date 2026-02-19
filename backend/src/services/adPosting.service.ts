import { db } from "../db";
import {
  clips,
  posts,
  massPostingApplications,
} from "@clipper/shared-db/src/schema";
import { eq, and, or, sql, desc, asc, ilike, gte, inArray } from "drizzle-orm";
import { teamService } from "./team.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { sqsService } from "./sqs.service";
import { googleDriveService } from "./google/drive.service";
import { s3Service } from "./s3.service";

const VALID_PLATFORMS = new Set(["tiktok", "instagram", "facebook", "youtube", "x"]);

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

    const [application] = await db
      .select()
      .from(massPostingApplications)
      .where(
        and(
          eq(massPostingApplications.team_id, teamId),
          eq(massPostingApplications.status, "accepted")
        )
      )
      .limit(1);

    if (!application) {
      throw new AdPostingError("Team is not approved for mass posting", 403);
    }

    const driveFolderId = application.google_drive_folder_id;
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

    if (usage.totalRemaining < totalCopies) {
      throw new AdPostingError(
        `Insufficient credits. Need ${totalCopies}, have ${usage.totalRemaining}`,
        402
      );
    }

    await teamService.incrementTeamUsage(teamId, totalCopies);

    await sqsService.sendAdPostingJob({
      clipId,
      teamId,
      userId,
      platformQuantities,
      driveFolderId,
      clipPath: clip.clip_path,
      clipTitle: clip.title || `clip-${clipId}`,
    });
  }

  async markAsPosted(postId: number, postUrl?: string): Promise<void> {
    const [post] = await db
      .select({ drive_file_id: posts.drive_file_id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    await db
      .update(posts)
      .set({
        status: "posted",
        post_url: postUrl || null,
        posted_time: new Date(),
        updated_at: new Date(),
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
    } = options;

    const conditions = [eq(posts.team_id, teamId)];

    // Status group filter
    if (tab === "queued") {
      conditions.push(
        or(
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
    if (dateRange !== "all") {
      const days = dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
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
