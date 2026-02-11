import * as Sentry from "@sentry/node";
import path from "path";
import os from "os";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

import { AdPostingJob } from "../../services/sqs.service";
import { db } from "../../db";
import {
  posts,
  teamMembers,
  users,
} from "@clipper/shared-db/src/schema";
import { eq, and } from "drizzle-orm";
import { s3Service } from "../../services/s3.service";
import { googleDriveService } from "../../services/google/drive.service";
import { generateJumbledMetadataString } from "../../utils/videoMetadata";
import {
  VIDEO_ENCODE_SETTINGS,
  AUDIO_ENCODE_SETTINGS,
} from "../../config/ffmpegSettings";
import { emailNotiService } from "../../services/emailNoti.service";
import { notifyAdPostingUpdate } from "../notify";

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
};

const FFMPEG_CONCURRENCY = 3;
const DRIVE_UPLOAD_CONCURRENCY = 5;

/** Simple concurrency limiter — no extra deps needed */
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

export async function processAdPostingJob(job: AdPostingJob): Promise<void> {
  const { teamId, clipId, platformQuantities, driveFolderId, clipPath, clipTitle } = job;

  const tempDir = path.join(os.tmpdir(), `ad-posting-${teamId}-${clipId}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const inputPath = path.join(tempDir, "input.mp4");

  const totalItems = Object.values(platformQuantities).reduce(
    (sum, qty) => sum + qty,
    0
  );
  let completedItems = 0;
  let successCount = 0;
  let failedCount = 0;

  const ffmpegLimit = createLimiter(FFMPEG_CONCURRENCY);
  const driveLimit = createLimiter(DRIVE_UPLOAD_CONCURRENCY);

  try {
    // 1. Download S3 clip once
    console.log(`[AdPosting] Downloading clip ${clipId} from S3...`);
    await s3Service.downloadFile(clipPath, inputPath);

    // 2. Pre-create platform subfolders (avoids race conditions)
    const platformFolders: Record<string, string> = {};
    await Promise.all(
      Object.keys(platformQuantities).map(async (platform) => {
        const displayName = PLATFORM_DISPLAY_NAMES[platform];
        platformFolders[platform] = await googleDriveService.ensurePlatformFolder(
          driveFolderId,
          displayName
        );
      })
    );

    // 3. Build flat task list across all platforms
    const tasks: { platform: string; copyIndex: number; platformTotal: number }[] = [];
    for (const [platform, qty] of Object.entries(platformQuantities)) {
      for (let i = 0; i < qty; i++) {
        tasks.push({ platform, copyIndex: i + 1, platformTotal: qty });
      }
    }

    // 4. Process all tasks concurrently with limiters
    await Promise.allSettled(
      tasks.map(({ platform, copyIndex, platformTotal }) => {
        const displayName = PLATFORM_DISPLAY_NAMES[platform];
        const outputPath = path.join(tempDir, `output_${platform}_${copyIndex}.mp4`);

        return (async () => {
          // Emit "processing" event
          await notifyAdPostingUpdate(teamId, {
            clipId,
            platform,
            platformName: displayName,
            status: "processing",
            copyIndex,
            platformTotal,
            totalItems,
            completedItems,
          });

          try {
            // FFmpeg re-encode with concurrency limit
            await ffmpegLimit(async () => {
              console.log(
                `[AdPosting] Re-encoding for ${displayName} copy ${copyIndex}/${platformTotal}...`
              );
              const metadataString = generateJumbledMetadataString();
              const cmd = `ffmpeg -y -i "${inputPath}" -map_metadata -1 ${VIDEO_ENCODE_SETTINGS} ${AUDIO_ENCODE_SETTINGS} -movflags +faststart ${metadataString} "${outputPath}"`;
              await execAsync(cmd, { timeout: 300000 });
            });

            // DB insert
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

            // Drive upload with concurrency limit
            const driveFileId = await driveLimit(async () => {
              const fileName = `${post.id}.mp4`;
              console.log(
                `[AdPosting] Uploading to Drive/${displayName}/${fileName} (copy ${copyIndex})...`
              );
              return googleDriveService.uploadFile(
                platformFolders[platform],
                fileName,
                outputPath,
                "video/mp4"
              );
            });

            // DB update
            await db
              .update(posts)
              .set({ drive_file_id: driveFileId })
              .where(eq(posts.id, post.id));

            completedItems++;
            successCount++;
            console.log(
              `[AdPosting] ${displayName} copy ${copyIndex} complete — post #${post.id}`
            );

            // Emit "uploaded" event
            await notifyAdPostingUpdate(teamId, {
              clipId,
              platform,
              platformName: displayName,
              status: "uploaded",
              postId: post.id,
              copyIndex,
              platformTotal,
              totalItems,
              completedItems,
            });
          } catch (err) {
            completedItems++;
            failedCount++;
            console.error(`[AdPosting] Failed for ${displayName} copy ${copyIndex}:`, err);
            Sentry.captureException(err);

            await notifyAdPostingUpdate(teamId, {
              clipId,
              platform,
              platformName: displayName,
              status: "failed",
              error: err instanceof Error ? err.message : "Unknown error",
              copyIndex,
              platformTotal,
              totalItems,
              completedItems,
            });
          } finally {
            // Clean up temp file immediately after upload
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
          }
        })();
      })
    );

    // 5. Emit completion event
    await notifyAdPostingUpdate(teamId, {
      clipId,
      platform: "",
      platformName: "",
      status: "complete",
      successCount,
      failedCount,
      totalItems,
      completedItems,
    });

    // 6. Send email with summary
    await sendCompletionEmail(
      teamId,
      clipTitle,
      platformQuantities,
      successCount,
      failedCount,
      totalItems
    );
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error("[AdPosting] Temp cleanup error:", cleanupErr);
    }
  }
}

async function sendCompletionEmail(
  teamId: number,
  clipTitle: string,
  platformQuantities: Record<string, number>,
  successCount: number,
  failedCount: number,
  totalCopies: number
) {
  try {
    const [owner] = await db
      .select({ email: users.email, firstName: users.first_name })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.user_id, users.id))
      .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.role, "owner")))
      .limit(1);

    if (owner?.email) {
      const platformNames = Object.keys(platformQuantities)
        .map((p) => {
          const qty = platformQuantities[p];
          const name = PLATFORM_DISPLAY_NAMES[p];
          return qty > 1 ? `${name} (x${qty})` : name;
        })
        .join(", ");

      const failedText = failedCount > 0 ? ` (${failedCount} failed)` : "";

      await emailNotiService.sendAdPostingReady(owner.email, {
        userName: owner.firstName || "there",
        clipTitle,
        platforms: `${successCount} of ${totalCopies} copies uploaded for: ${platformNames}${failedText}`,
        dashboardUrl: `${process.env.FRONTEND_URL || "https://platform.cuttr.com"}/dashboard/clips`,
      });
    }
  } catch (emailErr) {
    console.error("[AdPosting] Failed to send completion email:", emailErr);
  }
}
