import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { faceSwapService } from "../services/faceSwap.service";
import { detectFaceSegmentsWithPadding } from "../services/faceDetection.service";
import { getVideoDuration } from "../services/videoEditor.service";
import { generateJumbledMetadata } from "../utils/videoMetadata";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";

// Mobile-compatible H.264 encoding settings for downloads
const MOBILE_DOWNLOAD_SETTINGS = [
  "-c:v libx264", "-preset fast", "-crf 23",
  "-profile:v main", "-level 3.1", "-pix_fmt yuv420p",
  "-r 30", "-g 30", "-keyint_min 30", "-vsync cfr",
  "-bf 0", "-sc_threshold 0",
  "-c:a aac", "-ar 48000", "-ac 2", "-b:a 192k",
  "-fflags +genpts+igndts", "-avoid_negative_ts make_zero",
  "-reset_timestamps 1", "-start_at_zero", "-movflags +faststart",
];

export const trimVideo = async (req: AuthRequest, res: Response) => {
  const uploadedFile = req.file;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const { startTime, endTime, teamId } = req.body;

    // Validate required fields
    if (startTime === undefined || endTime === undefined || !teamId) {
      return res.status(400).json({
        error: "Missing required fields: startTime, endTime, and teamId are required",
      });
    }

    // Validate time range
    const start = parseFloat(startTime);
    const end = parseFloat(endTime);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "startTime and endTime must be valid numbers" });
    }

    if (start < 0) {
      return res.status(400).json({ error: "startTime cannot be negative" });
    }

    if (end <= start) {
      return res.status(400).json({ error: "endTime must be greater than startTime" });
    }

    const duration = end - start;
    if (duration > 30) {
      return res.status(400).json({ error: "Maximum clip duration is 30 seconds" });
    }

    if (duration < 1) {
      return res.status(400).json({ error: "Minimum clip duration is 1 second" });
    }

    console.log(`[FACE-SWAP] Processing trim: ${uploadedFile.originalname}, ${start}s to ${end}s`);

    // Trim the video and upload only the trimmed result to S3
    const result = await faceSwapService.trimAndUpload({
      inputPath: uploadedFile.path,
      startTime: start,
      endTime: end,
      teamId: parseInt(teamId),
    });

    return res.status(200).json({
      success: true,
      trimmedVideoKey: result.trimmedVideoKey,
      trimmedVideoUrl: result.trimmedVideoUrl,
      duration: result.duration,
    });
  } catch (error) {
    console.error("[FACE-SWAP] Trim video error:", error);
    Sentry.captureException(error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to trim video",
    });
  } finally {
    // Cleanup uploaded file
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try {
        fs.unlinkSync(uploadedFile.path);
        console.log(`[FACE-SWAP] Cleaned up uploaded file: ${uploadedFile.path}`);
      } catch (cleanupError) {
        console.error("[FACE-SWAP] Failed to cleanup uploaded file:", cleanupError);
      }
    }
  }
};

export const downloadFixed = async (req: AuthRequest, res: Response) => {
  const tempInputPath = path.join(os.tmpdir(), `dl_input_${Date.now()}.mp4`);
  const tempOutputPath = path.join(os.tmpdir(), `dl_output_${Date.now()}.mp4`);

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { url, filename } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing required 'url' parameter" });
    }

    console.log(`[DOWNLOAD-FIXED] Starting: ${url.substring(0, 100)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempInputPath, Buffer.from(arrayBuffer));
    console.log(`[DOWNLOAD-FIXED] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempInputPath)
        .outputOptions([
          ...MOBILE_DOWNLOAD_SETTINGS,
          ...generateJumbledMetadata(),
        ])
        .save(tempOutputPath)
        .on("progress", (progress) => {
          if (progress.percent && Math.round(progress.percent) % 25 === 0) {
            console.log(`[DOWNLOAD-FIXED] Normalizing: ${Math.round(progress.percent)}%`);
          }
        })
        .on("end", () => {
          console.log("[DOWNLOAD-FIXED] Normalization complete");
          resolve();
        })
        .on("error", (err) => {
          console.error("[DOWNLOAD-FIXED] FFmpeg error:", err.message);
          reject(err);
        });
    });

    const stats = fs.statSync(tempOutputPath);
    const outputFilename = typeof filename === "string" ? filename : "video-fixed.mp4";

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Content-Disposition", `attachment; filename="${outputFilename}"`);

    const readStream = fs.createReadStream(tempOutputPath);
    readStream.pipe(res);

    readStream.on("end", () => {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      console.log("[DOWNLOAD-FIXED] Sent and cleaned up");
    });

    readStream.on("error", (err) => {
      console.error("[DOWNLOAD-FIXED] Stream error:", err);
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    });
  } catch (error) {
    console.error("[DOWNLOAD-FIXED] Error:", error);
    Sentry.captureException(error);
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process video",
    });
  }
};

export const downloadFixedPublic = async (req: Request, res: Response) => {
  const tempInputPath = path.join(os.tmpdir(), `dl_input_${Date.now()}.mp4`);
  const tempOutputPath = path.join(os.tmpdir(), `dl_output_${Date.now()}.mp4`);

  try {
    const { url, filename } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing required 'url' parameter" });
    }

    console.log(`[DOWNLOAD-FIXED-PUBLIC] Starting: ${url.substring(0, 100)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempInputPath, Buffer.from(arrayBuffer));
    console.log(`[DOWNLOAD-FIXED-PUBLIC] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempInputPath)
        .outputOptions([
          ...MOBILE_DOWNLOAD_SETTINGS,
          ...generateJumbledMetadata(),
        ])
        .save(tempOutputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    const stats = fs.statSync(tempOutputPath);
    const outputFilename = typeof filename === "string" ? filename : "video-fixed.mp4";

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Content-Disposition", `attachment; filename="${outputFilename}"`);

    const readStream = fs.createReadStream(tempOutputPath);
    readStream.pipe(res);

    readStream.on("end", () => {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    });

    readStream.on("error", () => {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    });
  } catch (error) {
    console.error("[DOWNLOAD-FIXED-PUBLIC] Error:", error);
    Sentry.captureException(error);
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to process video",
    });
  }
};

/**
 * Detect faces in a video and return time segments where faces appear
 * Uses BlazeFace ML model for detection at 5 fps sampling
 */
export const detectFaces = async (req: AuthRequest, res: Response) => {
  const uploadedFile = req.file;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    console.log(`[FACE-DETECT] Starting detection for: ${uploadedFile.originalname}`);

    // Get video duration for padding logic
    const videoDuration = await getVideoDuration(uploadedFile.path);
    console.log(`[FACE-DETECT] Video duration: ${videoDuration.toFixed(2)}s`);

    // Validate video isn't too long (prevent abuse)
    const MAX_DETECTION_DURATION = 120; // 2 minutes max
    if (videoDuration > MAX_DETECTION_DURATION) {
      return res.status(400).json({
        error: `Video too long for face detection. Maximum ${MAX_DETECTION_DURATION} seconds allowed.`,
      });
    }

    // Run face detection via Lambda
    const segments = await detectFaceSegmentsWithPadding(
      uploadedFile.path,
      videoDuration
    );

    console.log(`[FACE-DETECT] Found ${segments.length} face segments`);

    return res.status(200).json({
      success: true,
      segments,
      videoDuration,
      segmentCount: segments.length,
    });
  } catch (error) {
    console.error("[FACE-DETECT] Error:", error);
    Sentry.captureException(error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to detect faces",
    });
  } finally {
    // Cleanup uploaded file
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try {
        fs.unlinkSync(uploadedFile.path);
        console.log(`[FACE-DETECT] Cleaned up uploaded file: ${uploadedFile.path}`);
      } catch (cleanupError) {
        console.error("[FACE-DETECT] Failed to cleanup:", cleanupError);
      }
    }
  }
};

export const faceSwapController = {
  trimVideo,
  downloadFixed,
  downloadFixedPublic,
  detectFaces,
};
