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

import {
  detectFacecamFromS3Key,
  detectMultipleFacesFromS3Key,
} from "../../services/facecamDetect.service";
import { getVideoDuration } from "../../services/clips/videoEditor.service";
import type { ClipServiceOptions } from "../../services/clips/clip.service";
import {
  buildSpeakerSegments,
  mapSpeakersToFaces,
  resolveSegmentFaces,
} from "../../services/clips/speakerSegments.service";
import { generateViralHeading } from "../../services/clips/headingAI.service";

export async function processClipVideoJob(job: ClipVideoJob): Promise<void> {
  const {
    clipIds,
    teamId,
    userId,
    s3Key,
    options,
    originalFileName,
    fileSize,
  } = job;

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
      console.log(
        "Gaming mode: skipping Deepgram transcription, using Gemini video analysis",
      );
    }

    // Get video duration for prompt context (prevents AI from suggesting out-of-bounds timestamps)
    const videoDuration = await getVideoDuration(localVideoPath);
    console.log(`Video duration: ${videoDuration.toFixed(1)}s`);

    const clipOptions: ClipGenerationOptions = {
      length: options.length,
      hookLength: options.hookLength,
      promptType: options.promptType,
      customPrompt: options.customPrompt,
      textPrompt: options.textPrompt,
      numberOfVideos: options.numberOfVideos,
      headingInstructions: options.headingInstructions,
      videoDuration,
      videoPath:
        options.promptType === "gaming" || options.promptType === "general" || options.promptType === "viral"
          ? localVideoPath
          : undefined,
    };

    const clipSuggestionsArray = await generateClipSuggestionsService(
      transcriptionData,
      clipOptions,
    );

    if (!clipSuggestionsArray || clipSuggestionsArray.length === 0) {
      throw new Error("Failed to generate clip suggestions");
    }

    // Extract thumbnail once (used for all clips)
    console.log("Extracting thumbnail from source video...");
    const thumbnailPath = await extractThumbnail(localVideoPath);
    const thumbnailS3Key = await s3Service.uploadThumbnail(
      thumbnailPath,
      teamId,
    );
    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    const transcriptionWords = transcriptionData
      ? transcriptionData.results.channels[0].alternatives[0].words.map(
          (w) => ({
            start: w.start,
            end: w.end,
            punctuated_word: w.punctuated_word,
            speaker: w.speaker,
          }),
        )
      : [];

    // Per-clip facecam detection callback — runs on each clip's merged horizontal
    // video instead of the full raw upload (smaller file, more accurate per-clip)
    const needsFacecamDetect =
      options.conversionMode === "gaming" ||
      options.conversionMode === "speaker-zoom";
    const needsMultiFaceDetect = options.conversionMode === "active-speaker";

    const onMergedRaw =
      needsFacecamDetect || needsMultiFaceDetect
        ? async (
            localMergedPath: string,
          ): Promise<ClipServiceOptions | null> => {
            const tempS3Key = `temp/facecam-detect/${teamId}/${Date.now()}.mp4`;
            try {
              console.log(
                `[CLIP-PROCESSOR] Uploading merged clip to temp S3 for facecam detection: ${tempS3Key}`,
              );
              await s3Service.uploadFile(
                localMergedPath,
                tempS3Key,
                "video/mp4",
              );

              if (needsFacecamDetect) {
                console.log(
                  `[CLIP-PROCESSOR] Detecting facecam on merged clip...`,
                );
                const result = await detectFacecamFromS3Key(tempS3Key);
                if (result?.facecamDetected) {
                  if (result.facecamRegion) {
                    console.log(
                      `[CLIP-PROCESSOR] Facecam region detected at ${result.corner}: ${JSON.stringify(result.facecamRegion)}`,
                    );
                    return { facecamRegion: result.facecamRegion };
                  } else if (result.faceRegion) {
                    console.log(
                      `[CLIP-PROCESSOR] Falling back to raw face region: ${JSON.stringify(result.faceRegion)}`,
                    );
                    return { facecamRegion: result.faceRegion };
                  }
                }
                console.warn(
                  `[CLIP-PROCESSOR] No facecam detected — will fall back to blurred-bg`,
                );
                return null;
              }

              if (needsMultiFaceDetect) {
                console.log(
                  `[CLIP-PROCESSOR] Detecting multiple faces on merged clip...`,
                );
                const multiFaceResult =
                  await detectMultipleFacesFromS3Key(tempS3Key);
                if (multiFaceResult && multiFaceResult.faceCount > 0) {
                  console.log(
                    `[CLIP-PROCESSOR] Found ${multiFaceResult.faceCount} faces, ${multiFaceResult.sceneCount ?? 1} scene(s)`,
                  );
                  let segments = buildSpeakerSegments(transcriptionWords);
                  const uniqueSpeakers = [
                    ...new Set(segments.map((s) => s.speaker)),
                  ];

                  if (segments.length > 1 && multiFaceResult.faceCount >= 2) {
                    if (
                      multiFaceResult.scenes &&
                      multiFaceResult.scenes.length > 1
                    ) {
                      segments = resolveSegmentFaces(
                        segments,
                        multiFaceResult.scenes,
                      );
                      console.log(
                        `[CLIP-PROCESSOR] Scene-aware face resolution: ${multiFaceResult.scenes.length} scenes`,
                      );
                    }
                    const faceMap = mapSpeakersToFaces(
                      uniqueSpeakers,
                      multiFaceResult.faces,
                    );
                    console.log(
                      `[CLIP-PROCESSOR] Active speaker mapping: ${uniqueSpeakers.length} speakers → ${multiFaceResult.faceCount} faces`,
                    );
                    return {
                      activeSpeakerSegments: segments,
                      speakerFaceMap: faceMap,
                    };
                  } else if (multiFaceResult.faceCount >= 1) {
                    console.log(
                      `[CLIP-PROCESSOR] Single face — using static zoom`,
                    );
                    return { facecamRegion: multiFaceResult.faces[0] };
                  }
                }
                console.warn(
                  `[CLIP-PROCESSOR] No faces detected — will fall back to blurred-bg`,
                );
                return null;
              }

              return null;
            } finally {
              try {
                await s3Service.deleteObject(tempS3Key);
              } catch {
                /* best effort */
              }
            }
          }
        : undefined;

    const clipServiceOptions = {
      customText: options.customText,
      textPosition: options.textPosition,
      textColor: options.textColor,
      textFont: options.textFont,
      textStyle: options.textStyle,
      textBgColor: options.textBgColor,
      captions: options.captions,
      captionColor: options.captionColor,
      captionFont: options.captionFont,
      conversionMode: options.conversionMode,
      backgroundMusicS3Key: options.backgroundMusicS3Key,
    };

    console.log(
      `Processing ${clipSuggestionsArray.length} clips sequentially...`,
    );

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < clipSuggestionsArray.length; i++) {
      const suggestions = clipSuggestionsArray[i];
      const clipId = clipIds[i];

      try {
        console.log(
          `\n=== Creating clip ${i + 1}/${clipSuggestionsArray.length} ===`,
        );

        let autoHeading: string | undefined;
        const perClipOptions = { ...clipServiceOptions };
        if (options.autoHeading !== false && !options.customText) {
          if (suggestions.viralHeading) {
            autoHeading = suggestions.viralHeading;
            console.log(`Clip ${i + 1} using AI-generated heading: "${autoHeading}"`);
            perClipOptions.customText = autoHeading;
          } else {
            try {
              const clipTranscript =
                suggestions.combined_script ||
                [
                  ...(suggestions.hook ? [suggestions.hook.text] : []),
                  ...suggestions.main.map((m) => m.text),
                ].join(" ");
              autoHeading = await generateViralHeading({
                transcription: clipTranscript,
                title: suggestions.clipTitle || "",
                headingInstructions: options.headingInstructions,
              });
              console.log(`Clip ${i + 1} fallback heading: "${autoHeading}"`);
              perClipOptions.customText = autoHeading;
            } catch (headingErr) {
              console.warn(
                `Clip ${i + 1} heading generation failed, skipping:`,
                headingErr,
              );
            }
          }
        }

        const result = await createCombinedClipService(
          localVideoPath,
          suggestions,
          transcriptionWords,
          perClipOptions,
          i,
          onMergedRaw,
        );

        console.log(`Clip ${i + 1} created, uploading to S3...`);

        const [clipS3Key, blankS3Key, watermarkedS3Key] = await Promise.all([
          s3Service.uploadGeneratedClip(result.finalPath, teamId, clipId),
          s3Service.uploadBlankClip(result.blankPath, teamId, clipId),
          s3Service.uploadWatermarkedClip(
            result.watermarkedPath,
            teamId,
            clipId,
          ),
        ]);

        const srtPath = path.join(outDir, `captions_${clipId}.srt`);
        fs.writeFileSync(srtPath, result.srtContent);
        const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipId);
        fs.unlinkSync(srtPath);

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
            ...(autoHeading
              ? {
                  editorConfig: {
                    heading: {
                      text: autoHeading,
                      color: options.textColor || "#FFFFFF",
                      font: options.textFont || "Montserrat",
                      x: 50,
                      y: 10,
                      fontSize: 48,
                      style: options.textStyle || "stroke",
                      headingBgColor: options.textBgColor || "#000000",
                    },
                    ...(options.backgroundMusicS3Key
                      ? {
                          audio: {
                            originalVolume: 1,
                            originalMuted: false,
                            backgroundMusic: {
                              s3Key: options.backgroundMusicS3Key,
                              volume: 0.3,
                              startTime: 0,
                              trimStart: 0,
                              trimEnd: 60,
                            },
                          },
                        }
                      : {}),
                  },
                }
              : options.backgroundMusicS3Key
                ? {
                    editorConfig: {
                      audio: {
                        originalVolume: 1,
                        originalMuted: false,
                        backgroundMusic: {
                          s3Key: options.backgroundMusicS3Key,
                          volume: 0.3,
                          startTime: 0,
                          trimStart: 0,
                          trimEnd: 60,
                        },
                      },
                    },
                  }
                : {}),
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
        if (fs.existsSync(result.watermarkedPath))
          fs.unlinkSync(result.watermarkedPath);

        await notifyClipsRefresh(teamId);

        successCount++;
        console.log(`Clip ${i + 1}/${clipSuggestionsArray.length} complete!`);
      } catch (clipError) {
        failedCount++;
        console.error(
          `Error processing clip ${i + 1} (ID: ${clipId}):`,
          clipError,
        );

        await clipManagerService.updateClipStatus(
          clipId,
          teamId,
          "failed",
          "Error",
        );

        await notifyClipsRefresh(teamId);
        console.log(
          `Clip ${i + 1} marked as failed, continuing with remaining clips...`,
        );
      }
    }

    console.log(
      `\nProcessing complete: ${successCount} succeeded, ${failedCount} failed out of ${clipIds.length} clips`,
    );

    if (successCount === 0 && failedCount > 0) {
      throw new Error(`All ${failedCount} clips failed to process`);
    }

    // Send email only after ALL clips are complete
    try {
      const user = await userService.getUserById(userId);
      const frontendUrl =
        process.env.FRONTEND_URL || "https://platform.cuttr.com";
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

    const alreadyHandled =
      error instanceof Error &&
      error.message.startsWith("All") &&
      error.message.includes("clips failed");

    if (!alreadyHandled) {
      for (const clipId of clipIds) {
        await clipManagerService.updateClipStatus(
          clipId,
          teamId,
          "failed",
          "Error",
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
