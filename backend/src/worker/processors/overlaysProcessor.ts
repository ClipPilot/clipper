import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import { UpdateOverlaysJob } from "../../services/sqs.service";
import { clipManagerService } from "../../services/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { notifyClipsRefresh } from "../notify";
import { addCaptionsFromData, CaptionEntry } from "../../services/captions.service";
import { regenerateClipWithTextOverlay } from "../../services/clip.service";

export async function processOverlaysJob(job: UpdateOverlaysJob): Promise<void> {
  const { clipId, teamId, captionsEnabled, captionsData, captionColor, captionFont, heading } = job;

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const localBlankPath = path.join(outDir, `blank_${clipId}_${Date.now()}.mp4`);
  let newClipPath = "";

  try {
    console.log(`Processing overlays for clip ${clipId}, captionsEnabled: ${captionsEnabled}, hasHeading: ${!!heading}`);

    // Get clip data
    const clip = await clipManagerService.getClipById(clipId, teamId);
    if (!clip.blank_video_path) {
      throw new Error("No blank video path found for clip");
    }

    // Download the blank video from S3
    console.log(`Downloading blank video from S3: ${clip.blank_video_path}`);
    await s3Service.downloadFile(clip.blank_video_path, localBlankPath);

    let currentVideoPath = localBlankPath;

    // Step 1: Apply heading if provided
    if (heading && heading.text.trim()) {
      console.log("Applying heading overlay...");
      const headingPath = await regenerateClipWithTextOverlay(currentVideoPath, {
        text: heading.text,
        color: heading.color || "#FFFFFF",
        font: heading.font || "Montserrat",
        x: heading.x ?? 50,
        y: heading.y ?? 10,
        fontSize: heading.fontSize ?? 48,
      });

      // If we already have a processed video (not the original blank), delete it
      if (currentVideoPath !== localBlankPath && fs.existsSync(currentVideoPath)) {
        fs.unlinkSync(currentVideoPath);
      }
      currentVideoPath = headingPath;
    }

    // Step 2: Apply captions if enabled
    if (captionsEnabled && captionsData && captionsData.length > 0) {
      console.log("Applying captions overlay...");
      newClipPath = path.join(outDir, `final_${clipId}_${Date.now()}.mp4`);
      await addCaptionsFromData(
        currentVideoPath,
        newClipPath,
        captionsData as CaptionEntry[],
        captionColor || "#FFD600",
        captionFont || "Montserrat"
      );

      // Clean up the intermediate file if it's not the original blank
      if (currentVideoPath !== localBlankPath && fs.existsSync(currentVideoPath)) {
        fs.unlinkSync(currentVideoPath);
      }
    } else if (currentVideoPath !== localBlankPath) {
      // No captions, but we have a heading - use the heading output as final
      newClipPath = currentVideoPath;
    } else {
      // No heading, no captions (or captions disabled) - just copy blank
      newClipPath = path.join(outDir, `final_${clipId}_${Date.now()}.mp4`);
      fs.copyFileSync(localBlankPath, newClipPath);
    }

    // Upload new clip to S3
    console.log("Uploading new clip to S3...");
    const newS3Key = await s3Service.uploadGeneratedClip(newClipPath, teamId, clipId);

    // Update database with new clip path and captions data
    await clipManagerService.updateClipCaptions(clipId, teamId, {
      clipPath: newS3Key,
      captionsData: captionsData as CaptionEntry[] || clip.captions_data,
    });

    // Set status back to completed
    await clipManagerService.updateClipStatus(clipId, teamId, "completed");

    console.log(`Successfully updated overlays for clip ${clipId}`);

    // Notify frontend
    await notifyClipsRefresh(teamId);
  } catch (error) {
    console.error(`Error processing overlays for clip ${clipId}:`, error);

    await clipManagerService.updateClipStatus(
      clipId,
      teamId,
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );

    await notifyClipsRefresh(teamId);

    throw error;
  } finally {
    // Clean up local files
    if (fs.existsSync(localBlankPath)) {
      fs.unlinkSync(localBlankPath);
    }
    if (newClipPath && fs.existsSync(newClipPath) && newClipPath !== localBlankPath) {
      fs.unlinkSync(newClipPath);
    }
  }
}
