import fs from "fs";
import path from "path";
import { SyncPrerecordedResponse } from "@deepgram/sdk";
import { ClipVideoJob } from "../../services/sqs.service";
import { transcribeVideoService } from "../../services/clips/transcription.service";
import {
  generateClipSuggestionsService,
  ClipGenerationOptions,
} from "../../services/aiSuggestions.service";
import { createCombinedClipService } from "../../services/clips/clip.service";
import { clipManagerService } from "../../services/clips/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { extractThumbnail } from "../../utils/extractThumbnail";
import { notifyClipsRefresh } from "../notify";
import { emailNotiService } from "../../services/emailNoti.service";
import { userService } from "../../services/user.service";
import { ensureOutputDir } from "../../utils/fileUtils";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";

export async function processClipVideoJob(job: ClipVideoJob): Promise<void> {
  const { clipIds, teamId, userId, s3Key, options, originalFileName, fileSize } = job;

  const outDir = ensureOutputDir();

  const localVideoPath = path.join(outDir, `raw_${Date.now()}.mp4`);

  try {
    console.log(`Starting clip processing for clips: ${clipIds.join(", ")}`);

    console.log(`Downloading video from S3: ${s3Key}`);
    await s3Service.downloadFile(s3Key, localVideoPath);
    console.log("Video downloaded successfully");

    // Skip Deepgram transcription for gaming — Gemini watches the video directly
    let transcriptionData: SyncPrerecordedResponse | null = null;
    if (options.promptType !== "gaming") {
      transcriptionData = await transcribeVideoService(localVideoPath);
      if (!transcriptionData) throw new Error("Transcription failed");
      console.log("Transcription completed successfully");
    } else {
      console.log("Gaming mode: skipping Deepgram transcription, using Gemini video analysis");
    }

    const clipOptions: ClipGenerationOptions = {
      length: options.length,
      hookLength: options.hookLength,
      promptType: options.promptType,
      customPrompt: options.customPrompt,
      textPrompt: options.textPrompt,
      numberOfVideos: options.numberOfVideos,
      videoPath: (options.promptType === "gaming" || options.promptType === "general") ? localVideoPath : undefined,
    };

    const clipSuggestionsArray = await generateClipSuggestionsService(
      transcriptionData,
      clipOptions
    );

    if (!clipSuggestionsArray || clipSuggestionsArray.length === 0) {
      throw new Error("Failed to generate clip suggestions");
    }

    // Extract thumbnail once (used for all clips)
    console.log("Extracting thumbnail from source video...");
    const thumbnailPath = await extractThumbnail(localVideoPath);
    const thumbnailS3Key = await s3Service.uploadThumbnail(thumbnailPath, teamId);
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    const transcriptionWords = transcriptionData
      ? transcriptionData.results.channels[0].alternatives[0].words
      : [];
    const clipServiceOptions = {
      customText: options.customText,
      textPosition: options.textPosition,
      textColor: options.textColor,
      textFont: options.textFont,
      captions: options.captions,
      captionColor: options.captionColor,
      captionFont: options.captionFont,
    };

    console.log(`Processing ${clipSuggestionsArray.length} clips sequentially...`);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < clipSuggestionsArray.length; i++) {
      const suggestions = clipSuggestionsArray[i];
      const clipId = clipIds[i];

      try {
        console.log(`\n=== Creating clip ${i + 1}/${clipSuggestionsArray.length} ===`);

        const result = await createCombinedClipService(
          localVideoPath,
          suggestions,
          transcriptionWords,
          clipServiceOptions,
          i
        );

        console.log(`Clip ${i + 1} created, uploading to S3...`);

        const [clipS3Key, blankS3Key, watermarkedS3Key] = await Promise.all([
          s3Service.uploadGeneratedClip(result.finalPath, teamId, clipId),
          s3Service.uploadBlankClip(result.blankPath, teamId, clipId),
          s3Service.uploadWatermarkedClip(result.watermarkedPath, teamId, clipId),
        ]);

        const srtPath = path.join(outDir, `captions_${clipId}.srt`);
        fs.writeFileSync(srtPath, result.srtContent);
        const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipId);
        fs.unlinkSync(srtPath);

        console.log(`Clip ${i + 1} uploaded, updating database...`);

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
          },
          inputMetadata: {
            originalFileName,
            fileSize,
          },
          prompt: options.textPrompt || options.customPrompt,
          message: suggestions.finalMessage,
          clipScore: suggestions.evalScore,
        });

        if (fs.existsSync(result.finalPath)) fs.unlinkSync(result.finalPath);
        if (fs.existsSync(result.blankPath)) fs.unlinkSync(result.blankPath);
        if (fs.existsSync(result.watermarkedPath)) fs.unlinkSync(result.watermarkedPath);

        await notifyClipsRefresh(teamId);

        successCount++;
        console.log(`Clip ${i + 1}/${clipSuggestionsArray.length} complete!`);
      } catch (clipError) {
        failedCount++;
        console.error(`Error processing clip ${i + 1} (ID: ${clipId}):`, clipError);

        await clipManagerService.updateClipStatus(
          clipId,
          teamId,
          "failed",
          clipError instanceof Error ? clipError.message : "Unknown error"
        );

        await notifyClipsRefresh(teamId);
        console.log(`Clip ${i + 1} marked as failed, continuing with remaining clips...`);
      }
    }

    console.log(`\nProcessing complete: ${successCount} succeeded, ${failedCount} failed out of ${clipIds.length} clips`);

    if (successCount === 0 && failedCount > 0) {
      throw new Error(`All ${failedCount} clips failed to process`);
    }

    // Send email only after ALL clips are complete
    try {
      const user = await userService.getUserById(userId);
      const frontendUrl = process.env.FRONTEND_URL || "https://platform.cuttr.com";
      await emailNotiService.sendClipsReady(user.email, {
        userName: user.first_name || "there",
        clipCount: clipIds.length,
        sourceFileName: originalFileName || "your video",
        clipsUrl: `${frontendUrl}/clips`,
      });
      console.log(`Clips ready email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send clips ready email:", emailError);
    }
  } catch (error) {
    console.error("Error processing clips:", error);

    const errorMessage = sanitizeErrorForFrontend(error, "Operation failed. Please try again.");
    const alreadyHandled = errorMessage.startsWith("All") && errorMessage.includes("clips failed");

    if (!alreadyHandled) {
      for (const clipId of clipIds) {
        await clipManagerService.updateClipStatus(
          clipId,
          teamId,
          "failed",
          errorMessage
        );
      }
      await notifyClipsRefresh(teamId);
    }

    throw error;
  } finally {
    if (fs.existsSync(localVideoPath)) {
      fs.unlinkSync(localVideoPath);
    }
  }
}
