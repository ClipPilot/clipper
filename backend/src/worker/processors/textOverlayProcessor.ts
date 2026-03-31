import fs from "fs";
import path from "path";
import { TextOverlayJob } from "../../services/sqs.service";
import { regenerateClipWithTextOverlay } from "../../services/clips/clip.service";
import { clipManagerService } from "../../services/clips/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { notifyClipsRefresh, notifyClipUpdate } from "../notify";
import { addCaptionsFromData, CaptionEntry } from "../../services/clips/captions.service";
import { ensureOutputDir } from "../../utils/fileUtils";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";

export async function processTextOverlayJob(
  job: TextOverlayJob
): Promise<void> {
  const { clipId, teamId, text, color, font, x, y, fontSize, style } = job;

  const outDir = ensureOutputDir();

  const localBlankPath = path.join(outDir, `blank_${clipId}_${Date.now()}.mp4`);
  let newClipPath: string | null = null;
  let textOverlayPath: string | null = null;

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
    textOverlayPath = await regenerateClipWithTextOverlay(localBlankPath, {
      text,
      color: color || "#FFFFFF",
      font: font || "Montserrat",
      x: x ?? 50,
      y: y ?? 10,
      fontSize: fontSize ?? 48,
      style: style || "stroke",
    });

    // Check if clip has captions - if so, apply them on top of the text overlay
    const captionsData = clip.captions_data as CaptionEntry[] | null;
    const clipMetadata = clip.clip_metadata as { parameters?: { captionColor?: string; captionFont?: string; captions?: boolean } } | null;

    if (captionsData && captionsData.length > 0) {
      console.log("Clip has captions, applying captions on top of text overlay...");
      const captionColor = clipMetadata?.parameters?.captionColor || "#FFD600";
      const captionFont = clipMetadata?.parameters?.captionFont || "Montserrat";

      const withCaptionsPath = path.join(outDir, `with_captions_${clipId}_${Date.now()}.mp4`);
      await addCaptionsFromData(textOverlayPath, withCaptionsPath, captionsData, captionColor, captionFont);

      // Clean up the intermediate text overlay file
      if (fs.existsSync(textOverlayPath)) {
        fs.unlinkSync(textOverlayPath);
      }

      newClipPath = withCaptionsPath;
      console.log("Captions applied successfully");
    } else {
      newClipPath = textOverlayPath;
      textOverlayPath = null; // Prevent cleanup since newClipPath points to same file
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
    await notifyClipUpdate(teamId, clipId);
    await notifyClipsRefresh(teamId);
  } catch (error) {
    console.error("Error applying heading:", error);

    // Update clip status to reflect the error
    await clipManagerService.updateClipStatus(
      clipId,
      teamId,
      "failed",
      `Applying heading failed: ${sanitizeErrorForFrontend(error, "Operation failed. Please try again.")}`
    );

    // Notify frontend
    await notifyClipUpdate(teamId, clipId);
    await notifyClipsRefresh(teamId);

    throw error;
  } finally {
    // Clean up local files
    if (fs.existsSync(localBlankPath)) {
      fs.unlinkSync(localBlankPath);
    }
    if (textOverlayPath && fs.existsSync(textOverlayPath)) {
      fs.unlinkSync(textOverlayPath);
    }
    if (newClipPath && fs.existsSync(newClipPath)) {
      fs.unlinkSync(newClipPath);
    }
  }
}
