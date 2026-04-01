import fs from "fs";
import path from "path";
import { s3Service } from "../../../services/s3.service";
import {
  detectFacecamFromS3Key,
  detectMultipleFacesFromS3Key,
} from "../../../services/facecamDetect.service";
import {
  buildSpeakerSegments,
  mapSpeakersToFaces,
  resolveSegmentFaces,
} from "../../../services/clips/speakerSegments.service";
import { generateViralHeading } from "../../../services/clips/headingAI.service";
import type { ClipServiceOptions } from "../../../services/clips/clip.service";
import type { TranscriptionWord } from "../../../services/clips/captions.service";
import type { ClipSuggestions, BatchClipSuggestions } from "../../../types/ai.types";
import type { ConversionMode } from "../../../constants/conversionModes";
import { ensureOutputDir } from "../../../utils/fileUtils";

interface ClipJobOptions {
  customText?: string;
  textPosition?: "top" | "bottom" | "middle";
  textColor?: string;
  textFont?: string;
  textStyle?: "stroke" | "instagram";
  textBgColor?: string;
  captions?: boolean;
  captionColor?: string;
  captionFont?: string;
  conversionMode?: ConversionMode;
  backgroundMusicS3Key?: string;
  autoHeading?: boolean;
  headingInstructions?: string;
}

export function buildFacecamDetectCallback(
  options: ClipJobOptions,
  teamId: number,
  words: TranscriptionWord[],
  logPrefix: string,
): ((localMergedPath: string) => Promise<ClipServiceOptions | null>) | undefined {
  const needsFacecamDetect =
    options.conversionMode === "gaming" ||
    options.conversionMode === "speaker-zoom";
  const needsMultiFaceDetect = options.conversionMode === "active-speaker";

  if (!needsFacecamDetect && !needsMultiFaceDetect) return undefined;

  return async (localMergedPath: string): Promise<ClipServiceOptions | null> => {
    const tempS3Key = `temp/facecam-detect/${teamId}/${Date.now()}.mp4`;
    try {
      console.log(
        `[${logPrefix}] Uploading merged clip to temp S3 for facecam detection: ${tempS3Key}`,
      );
      await s3Service.uploadFile(localMergedPath, tempS3Key, "video/mp4");

      if (needsFacecamDetect) {
        console.log(`[${logPrefix}] Detecting facecam on merged clip...`);
        const result = await detectFacecamFromS3Key(tempS3Key);
        if (result?.facecamDetected) {
          if (result.facecamRegion) {
            console.log(
              `[${logPrefix}] Facecam region detected at ${result.corner}: ${JSON.stringify(result.facecamRegion)}`,
            );
            return { facecamRegion: result.facecamRegion };
          } else if (result.faceRegion) {
            console.log(
              `[${logPrefix}] Falling back to raw face region: ${JSON.stringify(result.faceRegion)}`,
            );
            return { facecamRegion: result.faceRegion };
          }
        }
        console.warn(
          `[${logPrefix}] No facecam detected — will fall back to blurred-bg`,
        );
        return null;
      }

      if (needsMultiFaceDetect) {
        console.log(`[${logPrefix}] Detecting multiple faces on merged clip...`);
        const multiFaceResult = await detectMultipleFacesFromS3Key(tempS3Key);
        if (multiFaceResult && multiFaceResult.faceCount > 0) {
          console.log(
            `[${logPrefix}] Found ${multiFaceResult.faceCount} faces, ${multiFaceResult.sceneCount ?? 1} scene(s)`,
          );
          let segments = buildSpeakerSegments(words);
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
                `[${logPrefix}] Scene-aware face resolution: ${multiFaceResult.scenes.length} scenes`,
              );
            }
            const faceMap = mapSpeakersToFaces(
              uniqueSpeakers,
              multiFaceResult.faces,
            );
            console.log(
              `[${logPrefix}] Active speaker mapping: ${uniqueSpeakers.length} speakers → ${multiFaceResult.faceCount} faces`,
            );
            return {
              activeSpeakerSegments: segments,
              speakerFaceMap: faceMap,
            };
          } else if (multiFaceResult.faceCount >= 1) {
            console.log(`[${logPrefix}] Single face — using static zoom`);
            return { facecamRegion: multiFaceResult.faces[0] };
          }
        }
        console.warn(
          `[${logPrefix}] No faces detected — will fall back to blurred-bg`,
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
  };
}

export function buildClipServiceOptions(options: ClipJobOptions) {
  return {
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
}

export function buildEditorConfig(
  options: ClipJobOptions,
  autoHeading?: string,
): Record<string, unknown> {
  if (autoHeading) {
    return {
      editorConfig: {
        heading: {
          text: autoHeading,
          color:
            options.textColor ||
            ((options.textStyle || "stroke") === "instagram"
              ? (options.textBgColor || "#000000") === "#FFFFFF"
                ? "#000000"
                : "#FFFFFF"
              : "#FFFFFF"),
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
    };
  }

  if (options.backgroundMusicS3Key) {
    return {
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
    };
  }

  return {};
}

export async function generateAutoHeading(
  clipSuggestion: ClipSuggestions | BatchClipSuggestions,
  options: ClipJobOptions,
  clipLabel: string,
): Promise<{ autoHeading?: string; perClipOptions: ReturnType<typeof buildClipServiceOptions> }> {
  const perClipOptions = buildClipServiceOptions(options);

  if (options.autoHeading === false || options.customText) {
    return { perClipOptions };
  }

  if (clipSuggestion.viralHeading) {
    console.log(`${clipLabel} using AI-generated heading: "${clipSuggestion.viralHeading}"`);
    perClipOptions.customText = clipSuggestion.viralHeading;
    return { autoHeading: clipSuggestion.viralHeading, perClipOptions };
  }

  try {
    const clipTranscript =
      clipSuggestion.combined_script ||
      [
        ...(clipSuggestion.hook ? [clipSuggestion.hook.text] : []),
        ...clipSuggestion.main.map((m) => m.text),
      ].join(" ");
    const heading = await generateViralHeading({
      transcription: clipTranscript,
      title: clipSuggestion.clipTitle || "",
      headingInstructions: options.headingInstructions,
    });
    console.log(`${clipLabel} fallback heading: "${heading}"`);
    perClipOptions.customText = heading;
    return { autoHeading: heading, perClipOptions };
  } catch (headingErr) {
    console.warn(`${clipLabel} heading generation failed, skipping:`, headingErr);
    return { perClipOptions };
  }
}

export async function uploadClipArtifacts(params: {
  finalPath: string;
  blankPath: string;
  watermarkedPath: string;
  srtContent: string;
  teamId: number;
  clipId: number;
  srtPrefix?: string;
}): Promise<{
  clipS3Key: string;
  blankS3Key: string;
  watermarkedS3Key: string;
  srtS3Key: string;
}> {
  const { finalPath, blankPath, watermarkedPath, srtContent, teamId, clipId, srtPrefix } = params;

  const [clipS3Key, blankS3Key, watermarkedS3Key] = await Promise.all([
    s3Service.uploadGeneratedClip(finalPath, teamId, clipId),
    s3Service.uploadBlankClip(blankPath, teamId, clipId),
    s3Service.uploadWatermarkedClip(watermarkedPath, teamId, clipId),
  ]);

  const outDir = ensureOutputDir();
  const srtPath = path.join(outDir, `${srtPrefix || "captions"}_${clipId}.srt`);
  fs.writeFileSync(srtPath, srtContent);
  const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipId);
  fs.unlinkSync(srtPath);

  return { clipS3Key, blankS3Key, watermarkedS3Key, srtS3Key };
}

export function cleanupClipFiles(paths: string[]): void {
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
