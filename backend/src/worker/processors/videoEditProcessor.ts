import fs from "fs";
import path from "path";
import { VideoEditJob } from "../../services/sqs.service";
import { clipManagerService } from "../../services/clips/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { notifyClipsRefresh } from "../notify";
import { addCaptionsFromData, CaptionEntry } from "../../services/clips/captions.service";
import { regenerateClipWithTextOverlay } from "../../services/clips/clip.service";
import {
  cutClip,
  changeSpeed,
  changeAspectRatio,
  cropVideo,
  adjustVolume,
  mixBackgroundMusic,
  muteAudio,
} from "../../services/clips/videoEditor.service";
import { ensureOutputDir } from "../../utils/fileUtils";

/**
 * Process a video edit job.
 * Processing order: Trim → Speed → Crop → Audio → Heading → Captions
 * This ensures accurate positioning for overlays.
 */
export async function processVideoEditJob(job: VideoEditJob): Promise<void> {
  const { clipId, teamId, editConfig } = job;
  const { trim, crop, speed, audio, captions, heading } = editConfig;

  const outDir = ensureOutputDir();
  const timestamp = Date.now();

  // Track all temp files for cleanup
  const tempFiles: string[] = [];
  const localBlankPath = path.join(outDir, `blank_${clipId}_${timestamp}.mp4`);
  let currentVideoPath = localBlankPath;
  let finalClipPath = "";

  try {
    console.log(`[VIDEO-EDIT] Processing clip ${clipId}`);
    console.log(`[VIDEO-EDIT] Config: trim=${!!trim}, speed=${speed}, crop=${crop?.aspectRatio}, audio=${!!audio}, heading=${!!heading}, captions=${captions?.enabled}`);

    // Get clip data
    const clip = await clipManagerService.getClipById(clipId, teamId);
    if (!clip.blank_video_path) {
      throw new Error("No blank video path found for clip");
    }

    // Download the blank video from S3
    console.log(`[VIDEO-EDIT] Downloading blank video from S3: ${clip.blank_video_path}`);
    await s3Service.downloadFile(clip.blank_video_path, localBlankPath);
    tempFiles.push(localBlankPath);

    // ==========================================================================
    // Step 1: TRIM
    // ==========================================================================
    if (trim && (trim.startTime > 0 || trim.endTime < Infinity)) {
      console.log(`[VIDEO-EDIT] Step 1: Trimming ${trim.startTime}s to ${trim.endTime}s`);
      const trimmedPath = path.join(outDir, `trimmed_${clipId}_${timestamp}.mp4`);
      await cutClip(currentVideoPath, trimmedPath, trim.startTime, trim.endTime);

      if (currentVideoPath !== localBlankPath) {
        tempFiles.push(currentVideoPath);
      }
      currentVideoPath = trimmedPath;
      tempFiles.push(trimmedPath);
    }

    // ==========================================================================
    // Step 2: SPEED
    // ==========================================================================
    if (speed && speed !== 1.0) {
      console.log(`[VIDEO-EDIT] Step 2: Changing speed to ${speed}x`);
      const speedPath = path.join(outDir, `speed_${clipId}_${timestamp}.mp4`);
      await changeSpeed(currentVideoPath, speedPath, speed);

      currentVideoPath = speedPath;
      tempFiles.push(speedPath);
    }

    // ==========================================================================
    // Step 3: CROP
    // ==========================================================================
    if (crop) {
      if (crop.customCrop) {
        console.log(`[VIDEO-EDIT] Step 3: Custom crop to ${crop.customCrop.width}x${crop.customCrop.height}`);
        const cropPath = path.join(outDir, `crop_${clipId}_${timestamp}.mp4`);
        await cropVideo(currentVideoPath, cropPath, crop.customCrop);

        currentVideoPath = cropPath;
        tempFiles.push(cropPath);
      } else if (crop.aspectRatio && crop.aspectRatio !== "9:16") {
        console.log(`[VIDEO-EDIT] Step 3: Changing aspect ratio to ${crop.aspectRatio}`);
        const aspectPath = path.join(outDir, `aspect_${clipId}_${timestamp}.mp4`);
        await changeAspectRatio(currentVideoPath, aspectPath, crop.aspectRatio as "9:16" | "16:9" | "1:1" | "4:5");

        currentVideoPath = aspectPath;
        tempFiles.push(aspectPath);
      }
    }

    // ==========================================================================
    // Step 4: AUDIO
    // ==========================================================================
    if (audio) {
      // Handle muting or volume adjustment
      if (audio.originalMuted) {
        console.log(`[VIDEO-EDIT] Step 4: Muting original audio`);
        const mutedPath = path.join(outDir, `muted_${clipId}_${timestamp}.mp4`);
        await muteAudio(currentVideoPath, mutedPath);

        currentVideoPath = mutedPath;
        tempFiles.push(mutedPath);
      } else if (audio.originalVolume !== 1.0) {
        console.log(`[VIDEO-EDIT] Step 4: Adjusting volume to ${audio.originalVolume}`);
        const volumePath = path.join(outDir, `volume_${clipId}_${timestamp}.mp4`);
        await adjustVolume(currentVideoPath, volumePath, audio.originalVolume);

        currentVideoPath = volumePath;
        tempFiles.push(volumePath);
      }

      // Handle background music
      if (audio.backgroundMusic && audio.backgroundMusic.s3Key) {
        console.log(`[VIDEO-EDIT] Step 4b: Adding background music`);
        const localMusicPath = path.join(outDir, `music_${clipId}_${timestamp}.mp3`);
        await s3Service.downloadFile(audio.backgroundMusic.s3Key, localMusicPath);
        tempFiles.push(localMusicPath);

        const mixedPath = path.join(outDir, `mixed_${clipId}_${timestamp}.mp4`);
        await mixBackgroundMusic(currentVideoPath, localMusicPath, mixedPath, {
          originalVolume: audio.originalMuted ? 0 : (audio.originalVolume || 1),
          musicVolume: audio.backgroundMusic.volume || 0.5,
          musicStartTime: audio.backgroundMusic.startTime || 0,
          musicTrimStart: audio.backgroundMusic.trimStart || 0,
          musicTrimEnd: audio.backgroundMusic.trimEnd || 60,
        });

        currentVideoPath = mixedPath;
        tempFiles.push(mixedPath);
      }
    }

    // ==========================================================================
    // Step 5: HEADING OVERLAY
    // ==========================================================================
    if (heading && heading.text.trim()) {
      console.log(`[VIDEO-EDIT] Step 5: Adding heading overlay`);
      const headingPath = await regenerateClipWithTextOverlay(currentVideoPath, {
        text: heading.text,
        color: heading.color || "#FFFFFF",
        font: heading.font || "Montserrat",
        x: heading.x ?? 50,
        y: heading.y ?? 10,
        fontSize: heading.fontSize ?? 48,
      });

      currentVideoPath = headingPath;
      tempFiles.push(headingPath);
    }

    // ==========================================================================
    // Step 6: CAPTIONS
    // ==========================================================================
    if (captions?.enabled && captions.data && captions.data.length > 0) {
      console.log(`[VIDEO-EDIT] Step 6: Adding captions (${captions.data.length} segments)`);

      // Adjust caption timings if video was trimmed or speed-changed
      let adjustedCaptions = captions.data;
      if (trim || (speed && speed !== 1.0)) {
        adjustedCaptions = adjustCaptionTimings(captions.data, trim, speed);
      }

      finalClipPath = path.join(outDir, `final_${clipId}_${timestamp}.mp4`);
      await addCaptionsFromData(
        currentVideoPath,
        finalClipPath,
        adjustedCaptions as CaptionEntry[],
        captions.color || "#FFD600",
        captions.font || "Montserrat"
      );
      tempFiles.push(finalClipPath);
    } else {
      // No captions, use current as final
      finalClipPath = currentVideoPath;
    }

    // ==========================================================================
    // Upload and Update Database
    // ==========================================================================
    console.log(`[VIDEO-EDIT] Uploading final clip to S3...`);
    const newS3Key = await s3Service.uploadGeneratedClip(finalClipPath, teamId, clipId);

    // Update database with new clip path
    await clipManagerService.updateClipCaptions(clipId, teamId, {
      clipPath: newS3Key,
      captionsData: captions?.data as CaptionEntry[] || clip.captions_data,
    });

    // Store edit config in metadata for future reference
    const existingMetadata = (clip.clip_metadata as Record<string, any>) || {};
    await clipManagerService.updateClip(clipId, teamId, {
      clipMetadata: {
        ...existingMetadata,
        editorConfig: {
          version: 1,
          ...editConfig,
          lastEditedAt: new Date().toISOString(),
        },
      },
    });

    // Set status back to completed
    await clipManagerService.updateClipStatus(clipId, teamId, "completed");

    console.log(`[VIDEO-EDIT] Successfully processed clip ${clipId}`);

    // Notify frontend
    await notifyClipsRefresh(teamId);
  } catch (error) {
    console.error(`[VIDEO-EDIT] Error processing clip ${clipId}:`, error);

    await clipManagerService.updateClipStatus(
      clipId,
      teamId,
      "failed",
      error instanceof Error ? error.message : "Unknown error"
    );

    await notifyClipsRefresh(teamId);

    throw error;
  } finally {
    // Clean up all temp files
    console.log(`[VIDEO-EDIT] Cleaning up ${tempFiles.length} temp files`);
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          console.warn(`[VIDEO-EDIT] Failed to delete temp file: ${file}`);
        }
      }
    }
  }
}

/**
 * Adjust caption timings based on trim and speed changes.
 */
function adjustCaptionTimings(
  captions: Array<{ index: number; startTime: number; endTime: number; text: string }>,
  trim?: { startTime: number; endTime: number },
  speed?: number
): Array<{ index: number; startTime: number; endTime: number; text: string }> {
  const trimStart = trim?.startTime || 0;
  const trimEnd = trim?.endTime || Infinity;
  const speedMultiplier = speed || 1.0;

  return captions
    // Filter out captions that are completely outside the trim region
    .filter((c) => c.endTime > trimStart && c.startTime < trimEnd)
    .map((c, idx) => {
      // Adjust for trim (shift to new zero point)
      let newStart = Math.max(0, c.startTime - trimStart);
      let newEnd = Math.min(trimEnd - trimStart, c.endTime - trimStart);

      // Adjust for speed
      newStart = newStart / speedMultiplier;
      newEnd = newEnd / speedMultiplier;

      return {
        ...c,
        index: idx + 1, // Re-index after filtering
        startTime: newStart,
        endTime: newEnd,
      };
    });
}
