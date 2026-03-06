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
import { eq, and, inArray } from "drizzle-orm";
import { s3Service } from "../../services/s3.service";
import { googleDriveService } from "../../services/google/drive.service";
import { generateUniquifyString, hasAudioStream } from "../../utils/videoUniquify";
import { applyJumbledMetadata } from "../../utils/videoMetadata";
import { emailNotiService } from "../../services/emailNoti.service";
import { notifyAdPostingUpdate } from "../notify";
import { checkSscdSimilarity, generateAdversarialVideo } from "../../services/sscdSimilarity.service";
import { config } from "../../config/env";

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
};

const FFMPEG_CONCURRENCY = 3;
const DRIVE_UPLOAD_CONCURRENCY = 5;

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
  const { teamId, clipId, platformQuantities, driveFolderId, clipPath, clipTitle, postIds, scramblingLevel = "heavy" } = job;

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
    console.log(`[AdPosting] Downloading clip ${clipId} from S3...`);
    await s3Service.downloadFile(clipPath, inputPath);

    const inputHasAudio = hasAudioStream(inputPath);

    const estParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    }).formatToParts(new Date());
    const mm = estParts.find((p) => p.type === "month")!.value;
    const dd = estParts.find((p) => p.type === "day")!.value;
    const yyyy = estParts.find((p) => p.type === "year")!.value;
    const dateFolderId = await googleDriveService.ensurePlatformFolder(
      driveFolderId,
      `${mm}-${dd}-${yyyy}`
    );

    const platformFolders: Record<string, string> = {};
    await Promise.all(
      Object.keys(platformQuantities).map(async (platform) => {
        const displayName = PLATFORM_DISPLAY_NAMES[platform];
        platformFolders[platform] = await googleDriveService.ensurePlatformFolder(
          dateFolderId,
          displayName
        );
      })
    );

    // Build task list — use pre-created postIds when available (new flow),
    // fall back to old behavior for in-flight SQS messages during deploy
    const tasks: { platform: string; copyIndex: number; platformTotal: number; postId?: number }[] = [];
    if (postIds && postIds.length > 0) {
      const platformCounts: Record<string, { index: number; total: number }> = {};
      for (const { platform } of postIds) {
        if (!platformCounts[platform]) {
          const total = postIds.filter((p) => p.platform === platform).length;
          platformCounts[platform] = { index: 0, total };
        }
      }
      for (const { id, platform } of postIds) {
        const counter = platformCounts[platform];
        counter.index++;
        tasks.push({
          platform,
          copyIndex: counter.index,
          platformTotal: counter.total,
          postId: id,
        });
      }
    } else {
      for (const [platform, qty] of Object.entries(platformQuantities)) {
        for (let i = 0; i < qty; i++) {
          tasks.push({ platform, copyIndex: i + 1, platformTotal: qty });
        }
      }
    }

    await Promise.allSettled(
      tasks.map(({ platform, copyIndex, platformTotal, postId }) => {
        const displayName = PLATFORM_DISPLAY_NAMES[platform];
        const outputPath = path.join(tempDir, `output_${platform}_${copyIndex}.mp4`);

        return (async () => {
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
            if (scramblingLevel === "light") {
              // Light: metadata-only scrambling (stream copy, no re-encoding)
              console.log(
                `[AdPosting] Light scramble (metadata only) for ${displayName} copy ${copyIndex}/${platformTotal}...`
              );
              await applyJumbledMetadata(inputPath, outputPath);
            } else {
              // Heavy: full uniquify (visual + audio + metadata) + perturbation
              await ffmpegLimit(async () => {
                console.log(
                  `[AdPosting] Heavy scramble for ${displayName} copy ${copyIndex}/${platformTotal}...`
                );
                const { fullArgs } = generateUniquifyString(undefined, inputHasAudio);
                const cmd = `ffmpeg -y -i "${inputPath}" ${fullArgs} "${outputPath}"`;
                await execAsync(cmd, { timeout: 600000 });
              });

              // Adversarial perturbation AFTER FFmpeg so the pattern survives
              try {
                const uniquifiedKey = `temp-perturb/${teamId}/${clipId}/${Date.now()}_${copyIndex}.mp4`;
                await s3Service.uploadFile(outputPath, uniquifiedKey, "video/mp4");
                const uniquifiedUrl = `s3://${config.aws.s3Bucket}/${uniquifiedKey}`;
                const perturbedKey = `temp-perturbed/${teamId}/${clipId}/${Date.now()}_${copyIndex}.mp4`;
                const perturbedResult = await generateAdversarialVideo(uniquifiedUrl, perturbedKey);
                if (perturbedResult) {
                  console.log(`[AdPosting] Perturbation applied for ${displayName} copy ${copyIndex}`);
                  await s3Service.downloadFile(perturbedKey, outputPath);
                } else {
                  console.warn(`[AdPosting] Perturbation failed for ${displayName} copy ${copyIndex}, using uniquified video`);
                }
                s3Service.deleteObject(uniquifiedKey).catch(() => {});
                s3Service.deleteObject(perturbedKey).catch(() => {});
              } catch (perturbErr) {
                console.warn(`[AdPosting] Perturbation error (non-blocking):`, perturbErr);
              }

              try {
                const tempSscdKey = `temp-sscd/${teamId}/${clipId}/${Date.now()}_${copyIndex}.mp4`;
                await s3Service.uploadFile(outputPath, tempSscdKey, "video/mp4");
                const originalUrl = `s3://${config.aws.s3Bucket}/${clipPath}`;
                const modifiedUrl = `s3://${config.aws.s3Bucket}/${tempSscdKey}`;
                const result = await checkSscdSimilarity(originalUrl, modifiedUrl);
                if (result) {
                  console.log(`[AdPosting] SSCD similarity for ${displayName} copy ${copyIndex}: ${result.cosine_similarity} (below ${result.threshold}: ${result.below_threshold})`);
                }
                await s3Service.deleteObject(tempSscdKey).catch(() => {});
              } catch (sscdErr) {
                console.warn(`[AdPosting] SSCD check failed (non-blocking):`, sscdErr);
              }
            }

            let currentPostId: number;
            if (postId) {
              // New flow: update the pre-created "processing" row to "scheduled"
              await db
                .update(posts)
                .set({ status: "scheduled", updated_at: new Date() })
                .where(eq(posts.id, postId));
              currentPostId = postId;
            } else {
              // Legacy flow: insert a new row (backward compat for in-flight jobs)
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
              currentPostId = post.id;
            }

            const driveFileId = await driveLimit(async () => {
              const fileName = `${currentPostId}.mp4`;
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

            await db
              .update(posts)
              .set({ drive_file_id: driveFileId })
              .where(eq(posts.id, currentPostId));

            completedItems++;
            successCount++;
            console.log(
              `[AdPosting] ${displayName} copy ${copyIndex} complete — post #${currentPostId}`
            );

            await notifyAdPostingUpdate(teamId, {
              clipId,
              platform,
              platformName: displayName,
              status: "uploaded",
              postId: currentPostId,
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

            // Mark the pre-created row as failed so it shows in the dashboard
            if (postId) {
              try {
                await db
                  .update(posts)
                  .set({ status: "failed", updated_at: new Date() })
                  .where(eq(posts.id, postId));
              } catch (updateErr) {
                console.error(`[AdPosting] Failed to mark post #${postId} as failed:`, updateErr);
              }
            }

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
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
          }
        })();
      })
    );

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

    await sendCompletionEmail(
      teamId,
      clipTitle,
      platformQuantities,
      successCount,
      failedCount,
      totalItems
    );
  } catch (outerErr) {
    // If S3 download or Drive folder setup fails, mark all pre-created rows as "failed"
    // so they don't stay stuck in "processing" forever
    if (postIds && postIds.length > 0) {
      const ids = postIds.map((p) => p.id);
      try {
        await db
          .update(posts)
          .set({ status: "failed", updated_at: new Date() })
          .where(inArray(posts.id, ids));
        console.error(`[AdPosting] Marked ${ids.length} posts as failed due to setup error`);
      } catch (updateErr) {
        console.error("[AdPosting] Failed to mark posts as failed:", updateErr);
      }
    }
    Sentry.captureException(outerErr);
    throw outerErr;
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
