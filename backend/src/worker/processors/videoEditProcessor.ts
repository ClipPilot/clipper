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
  processSegments,
  applyMediaOverlays,
  MediaOverlayItem,
  generateCommentImage,
} from "../../services/clips/videoEditor.service";
import { ensureOutputDir } from "../../utils/fileUtils";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";

/**
 * Process a video edit job.
 * Processing order: Segments (or Trim+Speed) → Crop → Audio → Heading → Captions
 * This ensures accurate positioning for overlays.
 */
export async function processVideoEditJob(job: VideoEditJob): Promise<void> {
  const { clipId, teamId, editConfig } = job;
  const { segments, trim, crop, speed, audio, captions, heading, overlays } = editConfig;

  const outDir = ensureOutputDir();
  const timestamp = Date.now();

  // Track all temp files for cleanup
  const tempFiles: string[] = [];
  const localBlankPath = path.join(outDir, `blank_${clipId}_${timestamp}.mp4`);
  let currentVideoPath = localBlankPath;
  let finalClipPath = "";

  try {
    console.log(`[VIDEO-EDIT] Processing clip ${clipId}`);
    console.log(`[VIDEO-EDIT] Config: segments=${segments?.length || 0}, trim=${!!trim}, speed=${speed}, crop=${crop?.aspectRatio}, audio=${!!audio}, heading=${!!heading}, captions=${captions?.enabled}, overlays=${overlays?.length || 0}`);

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
    // Step 1: SEGMENTS (or legacy TRIM + SPEED)
    // Segments take precedence over legacy trim/speed if provided
    // ==========================================================================
    if (segments && segments.length > 0) {
      // New segment-based editing: cut, apply per-segment speed, and concatenate
      console.log(`[VIDEO-EDIT] Step 1: Processing ${segments.length} segments`);
      const segmentsPath = path.join(outDir, `segments_${clipId}_${timestamp}.mp4`);

      const { tempFiles: segmentTempFiles } = await processSegments(
        currentVideoPath,
        segmentsPath,
        segments,
        outDir
      );

      // Add segment temp files for cleanup
      tempFiles.push(...segmentTempFiles);
      currentVideoPath = segmentsPath;
      tempFiles.push(segmentsPath);
    } else {
      // Legacy: separate trim and speed steps
      // Step 1a: TRIM
      if (trim && (trim.startTime > 0 || trim.endTime < Infinity)) {
        console.log(`[VIDEO-EDIT] Step 1a: Trimming ${trim.startTime}s to ${trim.endTime}s`);
        const trimmedPath = path.join(outDir, `trimmed_${clipId}_${timestamp}.mp4`);
        await cutClip(currentVideoPath, trimmedPath, trim.startTime, trim.endTime);

        if (currentVideoPath !== localBlankPath) {
          tempFiles.push(currentVideoPath);
        }
        currentVideoPath = trimmedPath;
        tempFiles.push(trimmedPath);
      }

      // Step 1b: SPEED
      if (speed && speed !== 1.0) {
        console.log(`[VIDEO-EDIT] Step 1b: Changing speed to ${speed}x`);
        const speedPath = path.join(outDir, `speed_${clipId}_${timestamp}.mp4`);
        await changeSpeed(currentVideoPath, speedPath, speed);

        currentVideoPath = speedPath;
        tempFiles.push(speedPath);
      }
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
    // Step 3.5: MEDIA OVERLAYS (images/videos composited on top)
    // After crop so positions are relative to final frame, before text overlays
    // ==========================================================================
    if (overlays && overlays.length > 0) {
      console.log(`[VIDEO-EDIT] Step 3.5: Applying ${overlays.length} media overlay(s)`);

      // Download or generate each overlay
      const overlayItems: MediaOverlayItem[] = [];
      for (let i = 0; i < overlays.length; i++) {
        const overlay = overlays[i];

        if (overlay.type === "comment" && overlay.commentData) {
          // Generate comment image via Puppeteer
          const commentImagePath = path.join(outDir, `comment_${i}_${clipId}_${timestamp}.png`);

          // Download profile picture from S3 if provided
          let profilePicPath: string | undefined;
          if (overlay.commentData.profilePictureS3Key) {
            profilePicPath = path.join(outDir, `pfp_${i}_${clipId}_${timestamp}.jpg`);
            await s3Service.downloadFile(overlay.commentData.profilePictureS3Key, profilePicPath);
            tempFiles.push(profilePicPath);
          }

          const { width, height } = await generateCommentImage(
            {
              platform: overlay.commentData.platform,
              username: overlay.commentData.username,
              commentText: overlay.commentData.commentText,
              profilePicturePath: profilePicPath,
              likesCount: overlay.commentData.likesCount,
              isVerified: overlay.commentData.isVerified,
              timeAgo: overlay.commentData.timeAgo,
            },
            commentImagePath
          );
          tempFiles.push(commentImagePath);

          overlayItems.push({
            type: "image", // FFmpeg treats the generated PNG as a regular image
            localPath: commentImagePath,
            startTime: overlay.startTime,
            endTime: overlay.endTime,
            x: overlay.x,
            y: overlay.y,
            scale: overlay.scale,
            opacity: overlay.opacity,
            naturalWidth: width,
            naturalHeight: height,
          });
        } else {
          // Standard image/video overlay: download from S3
          const ext = overlay.fileName.split(".").pop() || "bin";
          const localOverlayPath = path.join(outDir, `overlay_${i}_${clipId}_${timestamp}.${ext}`);
          await s3Service.downloadFile(overlay.s3Key, localOverlayPath);
          tempFiles.push(localOverlayPath);

          overlayItems.push({
            type: overlay.type as "image" | "video",
            localPath: localOverlayPath,
            startTime: overlay.startTime,
            endTime: overlay.endTime,
            x: overlay.x,
            y: overlay.y,
            scale: overlay.scale,
            opacity: overlay.opacity,
            naturalWidth: overlay.naturalWidth,
            naturalHeight: overlay.naturalHeight,
          });
        }
      }

      const overlayPath = path.join(outDir, `overlayed_${clipId}_${timestamp}.mp4`);
      await applyMediaOverlays(currentVideoPath, overlayPath, overlayItems);
      currentVideoPath = overlayPath;
      tempFiles.push(overlayPath);
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
        style: heading.style || "stroke",
      });

      currentVideoPath = headingPath;
      tempFiles.push(headingPath);
    }

    // ==========================================================================
    // Step 6: CAPTIONS
    // ==========================================================================
    if (captions?.enabled && captions.data && captions.data.length > 0) {
      console.log(`[VIDEO-EDIT] Step 6: Adding captions (${captions.data.length} entries)`);

      // Adjust caption timings based on segments or legacy trim/speed
      let adjustedCaptions = captions.data;
      if (segments && segments.length > 0) {
        adjustedCaptions = adjustCaptionTimingsForSegments(captions.data, segments);
      } else if (trim || (speed && speed !== 1.0)) {
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
      sanitizeErrorForFrontend(error, "Operation failed. Please try again.")
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
 * Adjust caption timings based on trim and speed changes (legacy mode).
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

/**
 * Adjust caption timings based on segments (cuts, reordering, per-segment speed).
 * Maps captions from original video time to new concatenated video time.
 * Accounts for black gap durations between non-adjacent segments.
 */
function adjustCaptionTimingsForSegments(
  captions: Array<{ index: number; startTime: number; endTime: number; text: string }>,
  segments: Array<{ id: string; startTime: number; endTime: number; speed: number }>
): Array<{ index: number; startTime: number; endTime: number; text: string }> {
  const adjustedCaptions: Array<{ index: number; startTime: number; endTime: number; text: string }> = [];

  // Sort segments by startTime (same order as processSegments)
  const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

  // Calculate the output time offset for each segment, including gap durations
  let outputTimeOffset = 0;
  const segmentOutputTimes: Array<{
    segment: (typeof segments)[0];
    outputStart: number;
    outputEnd: number;
  }> = [];

  for (let i = 0; i < sortedSegments.length; i++) {
    const segment = sortedSegments[i];

    // Add gap duration before this segment
    if (i > 0) {
      const prevSegment = sortedSegments[i - 1];
      const gapDuration = segment.startTime - prevSegment.endTime;
      if (gapDuration > 0.05) {
        outputTimeOffset += gapDuration;
      }
    }

    const segmentDuration = segment.endTime - segment.startTime;
    const outputDuration = segmentDuration / segment.speed;
    segmentOutputTimes.push({
      segment,
      outputStart: outputTimeOffset,
      outputEnd: outputTimeOffset + outputDuration,
    });
    outputTimeOffset += outputDuration;
  }

  // For each caption, check if it overlaps with any segment
  for (const caption of captions) {
    for (const { segment, outputStart } of segmentOutputTimes) {
      // Check if caption overlaps with this segment's source time range
      if (caption.endTime > segment.startTime && caption.startTime < segment.endTime) {
        // Caption overlaps with this segment
        // Clamp caption times to segment bounds
        const clampedStart = Math.max(caption.startTime, segment.startTime);
        const clampedEnd = Math.min(caption.endTime, segment.endTime);

        // Calculate offset within segment and apply speed
        const offsetInSegment = clampedStart - segment.startTime;
        const durationInSegment = clampedEnd - clampedStart;

        // Map to output time
        const newStart = outputStart + offsetInSegment / segment.speed;
        const newEnd = newStart + durationInSegment / segment.speed;

        adjustedCaptions.push({
          ...caption,
          startTime: newStart,
          endTime: newEnd,
        });
      }
    }
  }

  // Sort by start time and re-index
  return adjustedCaptions
    .sort((a, b) => a.startTime - b.startTime)
    .map((c, idx) => ({
      ...c,
      index: idx + 1,
    }));
}
