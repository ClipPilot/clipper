import fs from "fs";
import path from "path";
import { BatchClipVideoJob } from "../../services/sqs.service";
import { transcribeMultipleVideosService } from "../../services/transcription.service";
import { generateBatchClipSuggestionsService } from "../../services/aiSuggestions.service";
import {
  createBatchCombinedClipService,
  BatchVideoSource,
} from "../../services/clip.service";
import { clipManagerService } from "../../services/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { extractThumbnail } from "../../utils/extractThumbnail";
import { notifyClipsRefresh } from "../notify";
import { emailNotiService } from "../../services/emailNoti.service";
import { userService } from "../../services/user.service";

export async function processBatchClipVideoJob(
  job: BatchClipVideoJob
): Promise<void> {
  const { clipIds, teamId, userId, videos, options } = job;

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const localVideoPaths: Array<{ path: string; videoIndex: number; fileName?: string }> = [];

  try {
    console.log(`Starting batch clip processing for clips: ${clipIds.join(", ")}`);
    console.log(`Processing ${videos.length} source videos`);

    // Step 1: Download all videos from S3
    for (const video of videos) {
      const localPath = path.join(
        outDir,
        `batch_raw_${video.videoIndex}_${Date.now()}.mp4`
      );
      console.log(`Downloading video ${video.videoIndex + 1} from S3: ${video.s3Key}`);
      await s3Service.downloadFile(video.s3Key, localPath);
      localVideoPaths.push({
        path: localPath,
        videoIndex: video.videoIndex,
        fileName: video.originalFileName,
      });
    }
    console.log("All videos downloaded successfully");

    // Step 2: Transcribe all videos in parallel
    console.log("Starting parallel transcription of all videos...");
    const transcriptions = await transcribeMultipleVideosService(
      localVideoPaths.map((v) => ({ path: v.path, videoIndex: v.videoIndex }))
    );
    console.log("All transcriptions completed");

    // Step 3: Generate batch clip suggestions
    console.log("Generating batch clip suggestions...");
    const batchClipSuggestions = await generateBatchClipSuggestionsService({
      length: options.length,
      hookLength: options.hookLength,
      promptType: options.promptType,
      customPrompt: options.customPrompt,
      textPrompt: options.textPrompt,
      numberOfVideos: options.numberOfVideos,
      batchTranscripts: transcriptions.map((t) => ({
        videoIndex: t.videoIndex,
        transcription: t.transcription,
        fileName: localVideoPaths.find((v) => v.videoIndex === t.videoIndex)?.fileName,
      })),
    });

    if (!batchClipSuggestions || batchClipSuggestions.length === 0) {
      throw new Error("Failed to generate batch clip suggestions");
    }
    console.log(`Generated ${batchClipSuggestions.length} batch clip suggestions`);

    // Step 4: Prepare video sources with transcription words
    const videoSources: BatchVideoSource[] = transcriptions.map((t) => ({
      videoIndex: t.videoIndex,
      localPath: t.filePath,
      transcriptionWords:
        t.transcription.results.channels[0].alternatives[0].words,
    }));

    // Step 5: Extract thumbnail from first video
    console.log("Extracting thumbnail from first source video...");
    const thumbnailPath = await extractThumbnail(localVideoPaths[0].path);
    const thumbnailS3Key = await s3Service.uploadThumbnail(thumbnailPath, teamId);
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    const clipServiceOptions = {
      customText: options.customText,
      textPosition: options.textPosition,
      textColor: options.textColor,
      textFont: options.textFont,
      captions: options.captions,
      captionColor: options.captionColor,
      captionFont: options.captionFont,
    };

    // Step 6: Create clips sequentially
    console.log(
      `Processing ${batchClipSuggestions.length} batch clips sequentially...`
    );

    for (let i = 0; i < batchClipSuggestions.length; i++) {
      const suggestions = batchClipSuggestions[i];
      const clipId = clipIds[i];

      console.log(
        `\n=== Creating batch clip ${i + 1}/${batchClipSuggestions.length} ===`
      );

      // Create the clip from multiple source videos
      const result = await createBatchCombinedClipService(
        videoSources,
        suggestions,
        clipServiceOptions,
        i
      );

      console.log(`Batch clip ${i + 1} created, uploading to S3...`);

      // Upload to S3
      const [clipS3Key, blankS3Key, watermarkedS3Key] = await Promise.all([
        s3Service.uploadGeneratedClip(result.finalPath, teamId, clipId),
        s3Service.uploadBlankClip(result.blankPath, teamId, clipId),
        s3Service.uploadWatermarkedClip(result.watermarkedPath, teamId, clipId),
      ]);

      // Upload SRT file
      const srtPath = path.join(outDir, `batch_captions_${clipId}.srt`);
      fs.writeFileSync(srtPath, result.srtContent);
      const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipId);
      fs.unlinkSync(srtPath);

      console.log(`Batch clip ${i + 1} uploaded, updating database...`);

      // Build source videos metadata for tracking
      const sourceVideosMetadata = videos.map((v) => ({
        videoIndex: v.videoIndex,
        s3Key: v.s3Key,
        fileName: v.originalFileName || `Video ${v.videoIndex + 1}`,
      }));

      // Update database
      await clipManagerService.updateClipComplete(clipId, teamId, {
        clipPath: clipS3Key,
        blankVideoPath: blankS3Key,
        watermarkedClipPath: watermarkedS3Key,
        srtPath: srtS3Key,
        captionsData: result.captionsData,
        sourceVideoPath: thumbnailS3Key,
        title: suggestions.clipTitle,
        clipMetadata: {
          clipSuggestions: suggestions,
          parameters: {
            length: options.length || 40,
            hookLength: options.hookLength || 6,
            promptType: options.promptType || "business",
            customText: options.customText,
            textPosition: options.textPosition,
            textColor: options.textColor,
            textFont: options.textFont,
            captions: options.captions || false,
            captionColor: options.captionColor,
            captionFont: options.captionFont,
          },
          batchInfo: {
            isBatch: true,
            sourceVideos: sourceVideosMetadata,
          },
        },
        inputMetadata: {
          originalFileName: videos.map((v) => v.originalFileName).join(", "),
          fileSize: videos.reduce((sum, v) => sum + (v.fileSize || 0), 0),
        },
        prompt: options.textPrompt || options.customPrompt,
        message: suggestions.finalMessage,
        clipScore: suggestions.evalScore,
      });

      // Clean up local files for this clip immediately
      if (fs.existsSync(result.finalPath)) fs.unlinkSync(result.finalPath);
      if (fs.existsSync(result.blankPath)) fs.unlinkSync(result.blankPath);
      if (fs.existsSync(result.watermarkedPath))
        fs.unlinkSync(result.watermarkedPath);

      // Notify frontend after each clip
      await notifyClipsRefresh(teamId);

      console.log(
        `Batch clip ${i + 1}/${batchClipSuggestions.length} complete and visible to user!`
      );
    }

    console.log(`\nSuccessfully processed all ${clipIds.length} batch clips`);

    // Send email notification
    try {
      const user = await userService.getUserById(userId);
      const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
      const fileNames = videos
        .map((v) => v.originalFileName || `Video ${v.videoIndex + 1}`)
        .join(", ");
      await emailNotiService.sendClipsReady(user.email, {
        userName: user.first_name || "there",
        clipCount: clipIds.length,
        sourceFileName: `${videos.length} videos: ${fileNames}`,
        clipsUrl: `${frontendUrl}/clips`,
      });
      console.log(`Batch clips ready email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send batch clips ready email:", emailError);
    }
  } catch (error) {
    console.error("Error processing batch clips:", error);

    for (const clipId of clipIds) {
      await clipManagerService.updateClipStatus(
        clipId,
        teamId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    await notifyClipsRefresh(teamId);

    throw error;
  } finally {
    // Clean up all local video files
    for (const { path: videoPath } of localVideoPaths) {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }
  }
}
