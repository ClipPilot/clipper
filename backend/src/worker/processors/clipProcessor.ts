import fs from "fs";
import path from "path";
import { ClipVideoJob } from "../../services/sqs.service";
import { transcribeVideoService } from "../../services/transcription.service";
import {
  generateClipSuggestionsService,
  ClipGenerationOptions,
} from "../../services/aiSuggestions.service";
import { createMultipleCombinedClipsService } from "../../services/clip.service";
import { clipManagerService } from "../../services/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { extractThumbnail } from "../../utils/extractThumbnail";
import { notifyClipsRefresh } from "../notify";

export async function processClipVideoJob(job: ClipVideoJob): Promise<void> {
  const { clipIds, teamId, userId, s3Key, options, originalFileName, fileSize } = job;

  // Create temp directory for processing
  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const localVideoPath = path.join(outDir, `raw_${Date.now()}.mp4`);

  try {
    console.log(`Starting clip processing for clips: ${clipIds.join(", ")}`);

    // Download the raw video from S3
    console.log(`Downloading video from S3: ${s3Key}`);
    await s3Service.downloadFile(s3Key, localVideoPath);
    console.log("Video downloaded successfully");

    // Transcribe the video
    const transcriptionData = await transcribeVideoService(localVideoPath);
    if (!transcriptionData) throw new Error("Transcription failed");
    console.log("Transcription completed successfully");

    // Generate clip suggestions using AI
    const clipOptions: ClipGenerationOptions = {
      length: options.length,
      hookLength: options.hookLength,
      promptType: options.promptType,
      customPrompt: options.customPrompt,
      textPrompt: options.textPrompt,
      numberOfVideos: options.numberOfVideos,
    };

    const clipSuggestionsArray = await generateClipSuggestionsService(
      transcriptionData,
      clipOptions
    );

    if (!clipSuggestionsArray || clipSuggestionsArray.length === 0) {
      throw new Error("Failed to generate clip suggestions");
    }

    // Create the video clips
    const clipResults = await createMultipleCombinedClipsService(
      localVideoPath,
      clipSuggestionsArray,
      transcriptionData.results.channels[0].alternatives[0].words,
      {
        customText: options.customText,
        textPosition: options.textPosition,
        textColor: options.textColor,
        captions: options.captions,
        captionColor: options.captionColor,
        captionFont: options.captionFont,
      }
    );

    console.log("Created clip results:", clipResults.length);

    // Extract and upload thumbnail
    console.log("Extracting thumbnail from source video...");
    const thumbnailPath = await extractThumbnail(localVideoPath);
    const thumbnailS3Key = await s3Service.uploadThumbnail(thumbnailPath, teamId);
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    // Process each clip result
    for (let i = 0; i < clipSuggestionsArray.length; i++) {
      const suggestions = clipSuggestionsArray[i];
      const result = clipResults[i];

      console.log(`Uploading clip ${i + 1}/${clipSuggestionsArray.length} to S3...`);

      // Upload generated clip
      const clipS3Key = await s3Service.uploadGeneratedClip(
        result.finalPath,
        teamId,
        clipIds[i]
      );

      // Upload blank clip (for future caption/text overlay edits)
      const blankS3Key = await s3Service.uploadBlankClip(
        result.blankPath,
        teamId,
        clipIds[i]
      );

      // Upload SRT file
      const srtPath = path.join(outDir, `captions_${clipIds[i]}.srt`);
      fs.writeFileSync(srtPath, result.srtContent);
      const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipIds[i]);
      fs.unlinkSync(srtPath);

      console.log(`Clip uploaded to S3 with key: ${clipS3Key}`);

      // Update clip record in database
      await clipManagerService.updateClipComplete(clipIds[i], teamId, {
        clipPath: clipS3Key,
        blankVideoPath: blankS3Key,
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
            captions: options.captions || false,
            captionColor: options.captionColor,
            captionFont: options.captionFont,
          },
        },
        inputMetadata: {
          originalFileName,
          fileSize,
        },
        prompt: options.textPrompt || options.customPrompt,
        message: suggestions.finalMessage,
        clipScore: suggestions.evalScore,
      });

      // Clean up local clip files
      if (fs.existsSync(result.finalPath)) {
        fs.unlinkSync(result.finalPath);
      }
      if (fs.existsSync(result.blankPath)) {
        fs.unlinkSync(result.blankPath);
      }
      console.log(`Cleaned up local clip files for clip ${clipIds[i]}`);
    }

    // Delete the raw video from S3 (no longer needed)
    try {
      await s3Service.deleteObject(s3Key);
      console.log(`Deleted raw video from S3: ${s3Key}`);
    } catch (error) {
      console.warn("Failed to delete raw video from S3:", error);
    }

    console.log(`Successfully processed all ${clipIds.length} clips`);

    // Notify frontend to refresh clips
    await notifyClipsRefresh(teamId);
  } catch (error) {
    console.error("Error processing clips:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // Mark all clips as failed
    for (const clipId of clipIds) {
      await clipManagerService.updateClipStatus(
        clipId,
        teamId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    // Notify frontend to refresh clips (to show error state)
    await notifyClipsRefresh(teamId);

    throw error; // Re-throw to mark the job as failed
  } finally {
    // Clean up local files
    if (fs.existsSync(localVideoPath)) {
      fs.unlinkSync(localVideoPath);
      console.log(`Cleaned up local video file: ${localVideoPath}`);
    }
  }
}
