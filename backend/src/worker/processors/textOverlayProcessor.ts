import fs from "fs";
import path from "path";
import { TextOverlayJob } from "../../services/sqs.service";
import { regenerateClipWithTextOverlay } from "../../services/clip.service";
import { clipManagerService } from "../../services/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { notifyClipsRefresh } from "../notify";

export async function processTextOverlayJob(
  job: TextOverlayJob
): Promise<void> {
  const { clipId, teamId, text, color, x, y, fontSize } = job;

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const localBlankPath = path.join(outDir, `blank_${clipId}_${Date.now()}.mp4`);
  let newClipPath: string | null = null;

  try {
    console.log(`Processing heading for clip ${clipId}, team ${teamId}`);

    // Get the clip from the database
    const clip = await clipManagerService.getClipById(clipId, teamId);

    if (!clip.blank_video_path) {
      throw new Error("No blank video available for this clip");
    }

    // Download the blank video from S3
    console.log(`Downloading blank video from S3: ${clip.blank_video_path}`);
    await s3Service.downloadFile(clip.blank_video_path, localBlankPath);

    // Regenerate clip with heading
    console.log("Regenerating clip with heading...");
    newClipPath = await regenerateClipWithTextOverlay(localBlankPath, {
      text,
      color: color || "#FFFFFF",
      x: x ?? 50,
      y: y ?? 10,
      fontSize: fontSize ?? 48,
    });

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
    const newClipS3Key = await s3Service.uploadGeneratedClip(
      newClipPath,
      teamId,
      clipId
    );

    // Update database with new clip path and set status back to completed
    await clipManagerService.updateClip(clipId, teamId, {
      clipPath: newClipS3Key,
    });
    await clipManagerService.updateClipStatus(clipId, teamId, "completed");

    console.log(`Successfully applied heading to clip ${clipId}`);

    // Notify frontend to refresh clips
    await notifyClipsRefresh(teamId);
  } catch (error) {
    console.error("Error applying heading:", error);

    // Update clip status to reflect the error
    await clipManagerService.updateClipStatus(
      clipId,
      teamId,
      "failed",
      `Applying heading failed: ${error instanceof Error ? error.message : "Unknown error"}`
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
