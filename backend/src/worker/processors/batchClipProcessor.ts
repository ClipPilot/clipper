import fs from "fs";
import path from "path";
import { BatchClipVideoJob } from "../../services/sqs.service";
import { transcribeMultipleVideosService } from "../../services/clips/transcription.service";
import { generateBatchClipSuggestionsService } from "../../services/aiSuggestions.service";
import {
  createBatchCombinedClipService,
  BatchVideoSource,
} from "../../services/clips/clip.service";
import { clipManagerService } from "../../services/clips/clipManager.service";
import { s3Service } from "../../services/s3.service";
import { extractThumbnail } from "../../utils/extractThumbnail";
import { notifyClipsRefresh } from "../notify";
import { ensureOutputDir } from "../../utils/fileUtils";
import {
  buildFacecamDetectCallback,
  buildClipServiceOptions,
  buildEditorConfig,
  generateAutoHeading,
  uploadClipArtifacts,
  cleanupClipFiles,
} from "./shared/clipProcessorHelpers";
import { userService } from "../../services/user.service";
import { emailNotiService } from "../../services/emailNoti.service";

export async function processBatchClipVideoJob(
  job: BatchClipVideoJob
): Promise<void> {
  const { clipIds, teamId, userId, videos, options } = job;

  const outDir = ensureOutputDir();

  const localVideoPaths: Array<{ path: string; videoIndex: number; fileName?: string }> = [];

  try {
    console.log(`Starting batch clip processing for clips: ${clipIds.join(", ")}`);
    console.log(`Processing ${videos.length} source videos`);

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

    console.log("Starting parallel transcription of all videos...");
    const transcriptions = await transcribeMultipleVideosService(
      localVideoPaths.map((v) => ({ path: v.path, videoIndex: v.videoIndex }))
    );
    console.log("All transcriptions completed");

    console.log("Generating batch clip suggestions...");
    const batchClipSuggestions = await generateBatchClipSuggestionsService({
      length: options.length,
      hookLength: options.hookLength,
      promptType: options.promptType,
      customPrompt: options.customPrompt,
      textPrompt: options.textPrompt,
      numberOfVideos: options.numberOfVideos,
      headingInstructions: options.headingInstructions,
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

    const videoSources: BatchVideoSource[] = transcriptions.map((t) => ({
      videoIndex: t.videoIndex,
      localPath: t.filePath,
      transcriptionWords:
        t.transcription.results.channels[0].alternatives[0].words.map(w => ({
          start: w.start,
          end: w.end,
          punctuated_word: w.punctuated_word,
          speaker: w.speaker,
        })),
    }));

    console.log("Extracting thumbnail from first source video...");
    const thumbnailPath = await extractThumbnail(localVideoPaths[0].path);
    const thumbnailS3Key = await s3Service.uploadThumbnail(thumbnailPath, teamId);
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    const allWords = videoSources.flatMap(s => s.transcriptionWords);

    const onMergedRaw = buildFacecamDetectCallback(
      options,
      teamId,
      allWords,
      "BATCH-PROCESSOR",
    );

    const clipServiceOptions = buildClipServiceOptions(options);

    console.log(`Processing ${batchClipSuggestions.length} batch clips sequentially...`);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batchClipSuggestions.length; i++) {
      const suggestions = batchClipSuggestions[i];
      const clipId = clipIds[i];

      try {
        console.log(`\n=== Creating batch clip ${i + 1}/${batchClipSuggestions.length} ===`);

        const { autoHeading, perClipOptions } = await generateAutoHeading(
          suggestions,
          options,
          `Batch clip ${i + 1}`,
        );

        const result = await createBatchCombinedClipService(
          videoSources,
          suggestions,
          perClipOptions,
          i,
          onMergedRaw,
        );

        console.log(`Batch clip ${i + 1} created, uploading to S3...`);

        const { clipS3Key, blankS3Key, watermarkedS3Key, srtS3Key } =
          await uploadClipArtifacts({
            finalPath: result.finalPath,
            blankPath: result.blankPath,
            watermarkedPath: result.watermarkedPath,
            srtContent: result.srtContent,
            teamId,
            clipId,
            srtPrefix: "batch_captions",
          });

        const sourceVideosMetadata = videos.map((v) => ({
          videoIndex: v.videoIndex,
          s3Key: v.s3Key,
          fileName: v.originalFileName || `Video ${v.videoIndex + 1}`,
        }));

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
            ...buildEditorConfig(options, autoHeading),
            parameters: {
              length: options.length || 40,
              hookLength: options.hookLength || 6,
              promptType: options.promptType || "business",
              customText: options.customText,
              textPosition: options.textPosition,
              textColor: options.textColor,
              textFont: options.textFont,
              textStyle: options.textStyle,
              captions: options.captions || false,
              captionColor: options.captionColor,
              captionFont: options.captionFont,
              conversionMode: options.conversionMode,
              facecamHeight: result.facecamHeight,
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

        cleanupClipFiles([result.finalPath, result.blankPath, result.watermarkedPath]);

        await notifyClipsRefresh(teamId);

        successCount++;
        console.log(`Batch clip ${i + 1}/${batchClipSuggestions.length} complete!`);
      } catch (clipError) {
        failedCount++;
        console.error(`Error processing batch clip ${i + 1} (ID: ${clipId}):`, clipError);

        await clipManagerService.updateClipStatus(
          clipId,
          teamId,
          "failed",
          "Error"
        );

        await notifyClipsRefresh(teamId);
        console.log(`Batch clip ${i + 1} marked as failed, continuing with remaining clips...`);
      }
    }

    console.log(`\nProcessing complete: ${successCount} succeeded, ${failedCount} failed out of ${clipIds.length} clips`);

    if (successCount === 0 && failedCount > 0) {
      throw new Error(`All ${failedCount} clips failed to process`);
    }

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

    const alreadyHandled = error instanceof Error
      && error.message.startsWith("All") && error.message.includes("clips failed");

    if (!alreadyHandled) {
      for (const clipId of clipIds) {
        await clipManagerService.updateClipStatus(
          clipId,
          teamId,
          "failed",
          "Error"
        );
      }
      await notifyClipsRefresh(teamId);
    }

    throw error;
  } finally {
    for (const { path: videoPath } of localVideoPaths) {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }
  }
}
