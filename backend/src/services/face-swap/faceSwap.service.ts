import * as Sentry from "@sentry/node";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import { s3Service } from "../s3.service";
import { applyJumbledMetadata } from "../../utils/videoMetadata";

// Mobile-compatible H.264 encoding settings
const MOBILE_VIDEO_SETTINGS = [
  "-profile:v main",
  "-level 4.0",
  "-pix_fmt yuv420p",
  "-r 30",
  "-g 30",
  "-keyint_min 30",
  "-vsync cfr",
];


interface TrimAndUploadParams {
  inputPath: string;
  startTime: number;
  endTime: number;
  teamId: number;
}

interface TrimResult {
  trimmedVideoKey: string;
  trimmedVideoUrl: string;
  duration: number;
}

/**
 * Trims a video to the specified time range using ffmpeg
 */
export const trimVideo = async (
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<void> => {
  const duration = endTime - startTime;
  console.log(`[FACE-SWAP] Trimming video: ${startTime}s to ${endTime}s (${duration.toFixed(1)}s)`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        `-ss ${startTime}`,
        `-t ${duration}`,
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        ...MOBILE_VIDEO_SETTINGS,
        "-ar 48000",
        "-ac 2",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
      ])
      .save(outputPath)
      .on("end", () => {
        // Verify the output file exists and has content
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`Trim failed: output file not created at ${outputPath}`));
        }
        const stats = fs.statSync(outputPath);
        if (stats.size < 1000) {
          return reject(new Error(`Trim failed: output file too small (${stats.size} bytes)`));
        }
        console.log(`[FACE-SWAP] Trim success: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`[FACE-SWAP] Trim failed: ${err.message}`);
        reject(err);
      });
  });
};

/**
 * Trims an uploaded video and uploads only the trimmed result to S3
 */
export const trimAndUpload = async (params: TrimAndUploadParams): Promise<TrimResult> => {
  const { inputPath, startTime, endTime, teamId } = params;
  const duration = endTime - startTime;

  // Create temp file for trimmed output
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "face-swap-"));
  const outputPath = path.join(tempDir, `trimmed-${Date.now()}.mp4`);

  try {
    // Trim the video
    await trimVideo(inputPath, outputPath, startTime, endTime);

    // Upload only the trimmed video to S3
    const trimmedKey = `teams/${teamId}/face-swap/trimmed-${Date.now()}.mp4`;
    console.log(`[FACE-SWAP] Uploading trimmed video to S3: ${trimmedKey}`);
    await s3Service.uploadFile(outputPath, trimmedKey, "video/mp4");

    // Get presigned URL for the trimmed video
    const trimmedVideoUrl = await s3Service.getPresignedUrl(trimmedKey);

    return {
      trimmedVideoKey: trimmedKey,
      trimmedVideoUrl,
      duration,
    };
  } finally {
    // Cleanup temp files
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      console.error("[FACE-SWAP] Cleanup error:", cleanupError);
      Sentry.captureException(cleanupError);
    }
  }
};

export const faceSwapService = {
  trimVideo,
  trimAndUpload,
};
