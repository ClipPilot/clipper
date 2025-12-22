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
import { emailNotiService } from "../../services/emailNoti.service";
import { userService } from "../../services/user.service";

export async function processClipVideoJob(job: ClipVideoJob): Promise<void> {
  const { clipIds, teamId, userId, s3Key, options, originalFileName, fileSize } = job;

  const outDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const localVideoPath = path.join(outDir, `raw_${Date.now()}.mp4`);

  try {
    console.log(`Starting clip processing for clips: ${clipIds.join(", ")}`);

    console.log(`Downloading video from S3: ${s3Key}`);
    await s3Service.downloadFile(s3Key, localVideoPath);
    console.log("Video downloaded successfully");

    const transcriptionData = await transcribeVideoService(localVideoPath);
    if (!transcriptionData) throw new Error("Transcription failed");
    console.log("Transcription completed successfully");

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

    console.log("Extracting thumbnail from source video...");
    const thumbnailPath = await extractThumbnail(localVideoPath);
    const thumbnailS3Key = await s3Service.uploadThumbnail(thumbnailPath, teamId);
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    console.log(`Uploading ${clipSuggestionsArray.length} clips to S3 in parallel...`);

    await Promise.all(
      clipSuggestionsArray.map(async (suggestions, i) => {
        const result = clipResults[i];

        const [clipS3Key, blankS3Key, watermarkedS3Key] = await Promise.all([
          s3Service.uploadGeneratedClip(result.finalPath, teamId, clipIds[i]),
          s3Service.uploadBlankClip(result.blankPath, teamId, clipIds[i]),
          s3Service.uploadWatermarkedClip(result.watermarkedPath, teamId, clipIds[i]),
        ]);

        const srtPath = path.join(outDir, `captions_${clipIds[i]}.srt`);
        fs.writeFileSync(srtPath, result.srtContent);
        const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipIds[i]);
        fs.unlinkSync(srtPath);

        console.log(`Clip ${i + 1}/${clipSuggestionsArray.length} uploaded to S3`);

        await clipManagerService.updateClipComplete(clipIds[i], teamId, {
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
      })
    );

    console.log(`Successfully processed all ${clipIds.length} clips`);
    await notifyClipsRefresh(teamId);

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
    if (fs.existsSync(localVideoPath)) {
      fs.unlinkSync(localVideoPath);
    }
  }
}
