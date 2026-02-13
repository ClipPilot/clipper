import { db } from "../db";
import {
  clips,
  posts,
  massPostingApplications,
} from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { teamService } from "./team.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { sqsService } from "./sqs.service";
import { googleDriveService } from "./google/drive.service";

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
