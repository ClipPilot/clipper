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
import { emailNotiService } from "../../services/emailNoti.service";
import { userService } from "../../services/user.service";
import { ensureOutputDir } from "../../utils/fileUtils";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";
import { detectFacecamFromS3Key, detectMultipleFacesFromS3Key } from "../../services/facecamDetect.service";
import type { FacecamRegion } from "../../services/clips/videoEditor.service";
import type { ClipServiceOptions } from "../../services/clips/clip.service";
import { buildSpeakerSegments, mapSpeakersToFaces } from "../../services/clips/speakerSegments.service";
import type { ActiveSpeakerSegment } from "../../services/clips/speakerSegments.service";

export async function processBatchClipVideoJob(
  job: BatchClipVideoJob
): Promise<void> {
  const { clipIds, teamId, userId, videos, options } = job;

  const outDir = ensureOutputDir();

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
        t.transcription.results.channels[0].alternatives[0].words.map(w => ({
          start: w.start,
          end: w.end,
          punctuated_word: w.punctuated_word,
          speaker: w.speaker,
        })),
    }));

    // Step 5: Extract thumbnail from first video
    console.log("Extracting thumbnail from first source video...");
    const thumbnailPath = await extractThumbnail(localVideoPaths[0].path);
    const thumbnailS3Key = await s3Service.uploadThumbnail(thumbnailPath, teamId);
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    const allWords = videoSources.flatMap(s => s.transcriptionWords);

    // Per-clip facecam detection callback
    const needsFacecamDetect = options.conversionMode === "gaming" || options.conversionMode === "speaker-zoom";
    const needsMultiFaceDetect = options.conversionMode === "active-speaker";

    const onMergedRaw = (needsFacecamDetect || needsMultiFaceDetect)
      ? async (localMergedPath: string): Promise<ClipServiceOptions | null> => {
          const tempS3Key = `temp/facecam-detect/${teamId}/${Date.now()}.mp4`;
          try {
            await s3Service.uploadFile(localMergedPath, tempS3Key, "video/mp4");

            if (needsFacecamDetect) {
              console.log(`[BATCH-PROCESSOR] Detecting facecam on merged clip...`);
              const result = await detectFacecamFromS3Key(tempS3Key);
              if (result?.facecamDetected) {
                if (options.conversionMode === "speaker-zoom" && result.faceRegion) {
                  return { facecamRegion: result.faceRegion };
                } else if (result.facecamRegion) {
                  return { facecamRegion: result.facecamRegion };
                }
              }
              console.warn(`[BATCH-PROCESSOR] No facecam detected — will fall back to blurred-bg`);
              return null;
            }

            if (needsMultiFaceDetect) {
              console.log(`[BATCH-PROCESSOR] Detecting multiple faces on merged clip...`);
              const multiFaceResult = await detectMultipleFacesFromS3Key(tempS3Key);
              if (multiFaceResult && multiFaceResult.faceCount > 0) {
                const segments = buildSpeakerSegments(allWords);
                const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))];
                if (segments.length > 1 && multiFaceResult.faceCount >= 2) {
                  const faceMap = mapSpeakersToFaces(uniqueSpeakers, multiFaceResult.faces);
                  return { activeSpeakerSegments: segments, speakerFaceMap: faceMap };
                } else if (multiFaceResult.faceCount >= 1) {
                  return { facecamRegion: multiFaceResult.faces[0] };
                }
              }
              console.warn(`[BATCH-PROCESSOR] No faces detected — falling back to blurred-bg`);
              return null;
            }

            return null;
          } finally {
            try { await s3Service.deleteObject(tempS3Key); } catch { /* best effort */ }
          }
        }
      : undefined;

    const clipServiceOptions = {
      customText: options.customText,
      textPosition: options.textPosition,
      textColor: options.textColor,
      textFont: options.textFont,
      captions: options.captions,
      captionColor: options.captionColor,
      captionFont: options.captionFont,
      conversionMode: options.conversionMode,
    };

    console.log(`Processing ${batchClipSuggestions.length} batch clips sequentially...`);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batchClipSuggestions.length; i++) {
      const suggestions = batchClipSuggestions[i];
      const clipId = clipIds[i];

      try {
        console.log(`\n=== Creating batch clip ${i + 1}/${batchClipSuggestions.length} ===`);

        const result = await createBatchCombinedClipService(
          videoSources,
          suggestions,
          { ...clipServiceOptions },
          i,
          onMergedRaw,
        );

        console.log(`Batch clip ${i + 1} created, uploading to S3...`);

        const [clipS3Key, blankS3Key, watermarkedS3Key] = await Promise.all([
          s3Service.uploadGeneratedClip(result.finalPath, teamId, clipId),
          s3Service.uploadBlankClip(result.blankPath, teamId, clipId),
          s3Service.uploadWatermarkedClip(result.watermarkedPath, teamId, clipId),
        ]);

        const srtPath = path.join(outDir, `batch_captions_${clipId}.srt`);
        fs.writeFileSync(srtPath, result.srtContent);
        const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipId);
        fs.unlinkSync(srtPath);

        console.log(`Batch clip ${i + 1} uploaded, updating database...`);

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
              conversionMode: options.conversionMode,
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

        if (fs.existsSync(result.finalPath)) fs.unlinkSync(result.finalPath);
        if (fs.existsSync(result.blankPath)) fs.unlinkSync(result.blankPath);
        if (fs.existsSync(result.watermarkedPath)) fs.unlinkSync(result.watermarkedPath);

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
          clipError instanceof Error ? clipError.message : "Unknown error"
        );

        await notifyClipsRefresh(teamId);
        console.log(`Batch clip ${i + 1} marked as failed, continuing with remaining clips...`);
      }
    }

    console.log(`\nProcessing complete: ${successCount} succeeded, ${failedCount} failed out of ${clipIds.length} clips`);

    if (successCount === 0 && failedCount > 0) {
      throw new Error(`All ${failedCount} clips failed to process`);
    }

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
    for (const { path: videoPath } of localVideoPaths) {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }
  }
}
