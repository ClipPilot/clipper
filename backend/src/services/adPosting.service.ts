import * as Sentry from "@sentry/node";
import path from "path";
import os from "os";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
import { db } from "../db";
import {
  clips,
  posts,
  massPostingApplications,
  teamMembers,
  teams,
  users,
} from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { s3Service } from "./s3.service";
import { teamService } from "./team.service";
import { googleDriveService } from "./google/drive.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { generateJumbledMetadataString } from "../utils/videoMetadata";
import {
  VIDEO_ENCODE_SETTINGS,
  AUDIO_ENCODE_SETTINGS,
} from "../config/ffmpegSettings";
import { emitAdPostingUpdate } from "./socket.service";
import { emailNotiService } from "./emailNoti.service";

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
};

const VALID_PLATFORMS = new Set(Object.keys(PLATFORM_DISPLAY_NAMES));

class AdPostingService {
  /**
   * Validates inputs and deducts credits synchronously,
   * then kicks off background processing. Returns immediately.
   */
  async validateAndStart(
    teamId: number,
    clipId: number,
    platforms: string[]
  ): Promise<void> {
    // Validate platforms
    for (const p of platforms) {
      if (!VALID_PLATFORMS.has(p)) {
        throw new AdPostingError(`Invalid platform: ${p}`, 400);
      }
    }

    // 1. Check mass posting eligibility
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

    // 2. Verify clip exists and belongs to team
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

    // 3. Check credits
    const usage = await getTeamUsage(teamId);
    if (!usage) {
      throw new AdPostingError("Could not retrieve team usage", 500);
    }

    if (usage.totalRemaining < platforms.length) {
      throw new AdPostingError(
        `Insufficient credits. Need ${platforms.length}, have ${usage.totalRemaining}`,
        402
      );
    }

    // 4. Deduct credits upfront
    await teamService.incrementTeamUsage(teamId, platforms.length);

    // 5. Fire and forget background processing
    this.processInBackground(teamId, clipId, clip, platforms, driveFolderId).catch((err) => {
      console.error("[AdPosting] Background processing fatal error:", err);
      Sentry.captureException(err);
    });
  }

  private async processInBackground(
    teamId: number,
    clipId: number,
    clip: any,
    platforms: string[],
    driveFolderId: string
  ): Promise<void> {
    const tempDir = path.join(os.tmpdir(), `ad-posting-${teamId}-${clipId}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const inputPath = path.join(tempDir, "input.mp4");
    const clipTitle = clip.title || `clip-${clipId}`;

    let completedCount = 0;
    const totalPlatforms = platforms.length;

    try {
      console.log(`[AdPosting] Downloading clip ${clipId} from S3...`);
      await s3Service.downloadFile(clip.clip_path, inputPath);

      for (const platform of platforms) {
        const displayName = PLATFORM_DISPLAY_NAMES[platform];
        const outputPath = path.join(tempDir, `output_${platform}.mp4`);

        // Emit "processing" event
        emitAdPostingUpdate(teamId, {
          clipId,
          platform,
          platformName: displayName,
          status: "processing",
          totalPlatforms,
          completedPlatforms: completedCount,
        });

        try {
          // Re-encode with unique metadata
          console.log(`[AdPosting] Re-encoding for ${displayName}...`);
          const metadataString = generateJumbledMetadataString();
          const cmd = `ffmpeg -y -i "${inputPath}" -map_metadata -1 ${VIDEO_ENCODE_SETTINGS} ${AUDIO_ENCODE_SETTINGS} -movflags +faststart ${metadataString} "${outputPath}"`;
          await execAsync(cmd, { timeout: 300000 });

          // Insert post record first to get the ID for the Drive filename
          const [post] = await db
            .insert(posts)
            .values({
              team_id: teamId,
              clip_id: clipId,
              content: clipTitle,
              platform: platform as any,
              status: "scheduled",
            })
            .returning({ id: posts.id });

          // Ensure platform subfolder in Drive
          const subfolderId = await googleDriveService.ensurePlatformFolder(
            driveFolderId,
            displayName
          );

          // Upload to Drive with post ID as filename
          const fileName = `${post.id}.mp4`;
          console.log(`[AdPosting] Uploading to Drive/${displayName}/${fileName}...`);
          const driveFileId = await googleDriveService.uploadFile(
            subfolderId,
            fileName,
            outputPath,
            "video/mp4"
          );

          // Update post with drive file ID
          await db
            .update(posts)
            .set({ drive_file_id: driveFileId })
            .where(eq(posts.id, post.id));

          completedCount++;
          console.log(`[AdPosting] ${displayName} complete — post #${post.id}`);

          // Emit "uploaded" event
          emitAdPostingUpdate(teamId, {
            clipId,
            platform,
            platformName: displayName,
            status: "uploaded",
            postId: post.id,
            totalPlatforms,
            completedPlatforms: completedCount,
          });
        } catch (err) {
          completedCount++;
          console.error(`[AdPosting] Failed for ${displayName}:`, err);
          Sentry.captureException(err);

          emitAdPostingUpdate(teamId, {
            clipId,
            platform,
            platformName: displayName,
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
            totalPlatforms,
            completedPlatforms: completedCount,
          });
        } finally {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        }
      }

      // All done — emit completion event
      emitAdPostingUpdate(teamId, {
        clipId,
        platform: "",
        platformName: "",
        status: "complete",
        totalPlatforms,
        completedPlatforms: completedCount,
      });

      // Send email to team owner
      await this.sendCompletionEmail(teamId, clipTitle, platforms);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error("[AdPosting] Temp cleanup error:", cleanupErr);
      }
    }
  }

  private async sendCompletionEmail(teamId: number, clipTitle: string, platforms: string[]) {
    try {
      const [owner] = await db
        .select({ email: users.email, firstName: users.first_name })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.user_id, users.id))
        .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")))
        .limit(1);

      if (owner?.email) {
        const platformNames = platforms.map((p) => PLATFORM_DISPLAY_NAMES[p]).join(", ");
        await emailNotiService.sendAdPostingReady(owner.email, {
          userName: owner.firstName || "there",
          clipTitle,
          platforms: platformNames,
          dashboardUrl: `${process.env.FRONTEND_URL || "https://platform.cuttr.com"}/dashboard/clips`,
        });
      }
    } catch (emailErr) {
      console.error("[AdPosting] Failed to send completion email:", emailErr);
    }
  }

  /**
   * Called by botfarm webhook to mark a post as posted with the live URL
   */
  async markAsPosted(postId: number, postUrl?: string): Promise<void> {
    await db
      .update(posts)
      .set({
        status: "posted",
        post_url: postUrl || null,
        posted_time: new Date(),
        updated_at: new Date(),
      })
      .where(eq(posts.id, postId));
  }

  /**
   * Get all posts for a specific clip
   */
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
