import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import { UpdateCaptionsJob } from "../../services/sqs.service";
import { regenerateClipWithCaptions } from "../../services/clip.service";
import { clipManagerService } from "../../services/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { notifyClipsRefresh } from "../notify";

export async function processCaptionsJob(job: UpdateCaptionsJob): Promise<void> {
  const { clipId, teamId, captionsData, captionColor, captionFont, captionsEnabled = true } = job;

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const localBlankPath = path.join(outDir, `blank_${clipId}_${Date.now()}.mp4`);
  let newClipPath: string | null = null;

  try {
    console.log(`Processing captions update for clip ${clipId}, team ${teamId}, captionsEnabled: ${captionsEnabled}`);

    // Get the clip from the database
    const clip = await clipManagerService.getClipById(clipId, teamId);

    if (!clip.blank_video_path) {
      throw new Error("No blank video available for this clip");
    }

    // Download the blank video from S3
    console.log(`Downloading blank video from S3: ${clip.blank_video_path}`);
    await s3Service.downloadFile(clip.blank_video_path, localBlankPath);

    if (captionsEnabled) {
      // Get caption color and font from job or existing metadata
      const metadata = clip.clip_metadata as any;
      const color = captionColor || metadata?.parameters?.captionColor || "#FFD600";
      const font = captionFont || metadata?.parameters?.captionFont || "Montserrat";

      // Regenerate clip with new captions
      console.log("Regenerating clip with updated captions...");
      newClipPath = await regenerateClipWithCaptions(localBlankPath, captionsData, color, font);
    } else {
      // No captions - just use the blank video as the output
      console.log("Captions disabled - using blank video without captions");
      newClipPath = path.join(outDir, `no_captions_${clipId}_${Date.now()}.mp4`);
      fs.copyFileSync(localBlankPath, newClipPath);
    }

    // Delete old clip from S3
    if (clip.clip_path) {
      try {
        await s3Service.deleteObject(clip.clip_path);
        console.log(`Deleted old clip from S3: ${clip.clip_path}`);
      } catch (error) {
        console.warn("Failed to delete old clip from S3:", error);
      }
    }

    // Upload new clip to S3
    console.log("Uploading new clip to S3...");
    const newClipS3Key = await s3Service.uploadGeneratedClip(newClipPath, teamId, clipId);

    // Update database with new clip path and captions data
    await clipManagerService.updateClipCaptions(clipId, teamId, {
      clipPath: newClipS3Key,
      captionsData,
    });

    // Set status back to completed
    await clipManagerService.updateClipStatus(clipId, teamId, "completed");

    console.log(`Successfully updated captions for clip ${clipId}`);

    // Notify frontend to refresh clips
    await notifyClipsRefresh(teamId);
  } catch (error) {
    console.error("Error updating captions:", error);

    // Update clip status to reflect the error
    await clipManagerService.updateClipStatus(
      clipId,
      teamId,
      "failed",
      `Captions update failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );

    // Notify frontend
    await notifyClipsRefresh(teamId);

    throw error;
  } finally {
    // Clean up local files
    if (fs.existsSync(localBlankPath)) {
      fs.unlinkSync(localBlankPath);
    }
    if (newClipPath && fs.existsSync(newClipPath)) {
      fs.unlinkSync(newClipPath);
    }
  }
}
