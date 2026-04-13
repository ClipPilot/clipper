import { Request, Response } from "express";
import type { ErrorResponse } from "../types/api.types";
import { AuthRequest } from "../middleware/auth.middleware";
import { faceSwapService } from "../services/face-swap/faceSwap.service";
import { detectFaceSegmentsWithPadding, detectFaceSegmentsFromS3Key } from "../services/face-swap/faceDetection.service";
import { s3Service } from "../services/s3.service";
import { getVideoDuration } from "../services/clips/videoEditor.service";
import { generateJumbledMetadata } from "../utils/videoMetadata";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import { handleControllerError, requireUser } from "../utils/controllerHelpers";
import { validateUserUrl } from "../utils/urlValidator";

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

export const trimVideo = async (req: AuthRequest, res: Response<{ success: true; trimmedVideoKey: string; trimmedVideoUrl: string; duration: number } | ErrorResponse>) => {
  const uploadedFile = req.file;

  try {
    const userId = requireUser(req, res);
    if (!userId) return;

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
    return handleControllerError(res, "[FACE-SWAP] Trim video error", error, "Failed to trim video");
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
    const userId = requireUser(req, res);
    if (!userId) return;

    const { url, filename, mode } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing required 'url' parameter" });
    }

    const urlCheck = await validateUserUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.error });
    }

    const rawFilename = typeof filename === "string" ? filename : "video.mp4";
    const outputFilename = rawFilename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

    if (mode === "direct") {
      console.log(`[DOWNLOAD] Direct proxy: ${url.substring(0, 100)}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      res.setHeader("Content-Type", "video/mp4");
      if (response.headers.get("content-length")) {
        res.setHeader("Content-Length", response.headers.get("content-length")!);
      }
      res.setHeader("Content-Disposition", `attachment; filename="${outputFilename}"`);

      // Stream directly to response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
      console.log("[DOWNLOAD] Direct proxy complete");
      return;
    }

    console.log(`[DOWNLOAD-FIXED] Starting (mode=${mode || "full"}): ${url.substring(0, 100)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempInputPath, Buffer.from(arrayBuffer));
    console.log(`[DOWNLOAD-FIXED] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

    // Remux mode: copy streams without re-encoding (much faster)
    // -map_metadata -1 strips corrupted input metadata, then we apply fresh jumbled metadata
    const ffmpegOptions = mode === "remux"
      ? [
          "-map_metadata", "-1",
          "-c:v copy",
          "-c:a copy",
          "-movflags +faststart",
          ...generateJumbledMetadata(),
        ]
      : [
          "-map_metadata", "-1",
          ...MOBILE_DOWNLOAD_SETTINGS,
          ...generateJumbledMetadata(),
        ];

    // Fallback options: simple copy without any metadata processing
    const fallbackOptions = ["-c:v copy", "-c:a copy", "-movflags +faststart"];

    const runFFmpeg = (options: string[], label: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .outputOptions(options)
          .save(tempOutputPath)
          .on("progress", (progress) => {
            if (mode !== "remux" && progress.percent && Math.round(progress.percent) % 25 === 0) {
              console.log(`[DOWNLOAD-FIXED] ${label}: ${Math.round(progress.percent)}%`);
            }
          })
          .on("end", () => {
            console.log(`[DOWNLOAD-FIXED] ${label} complete`);
            resolve();
          })
          .on("error", (err) => {
            console.error(`[DOWNLOAD-FIXED] ${label} error:`, err.message);
            reject(err);
          });
      });
    };

    try {
      await runFFmpeg(ffmpegOptions, `Processing (mode=${mode || "full"})`);
    } catch (firstError) {
      console.log("[DOWNLOAD-FIXED] First attempt failed, trying fallback without metadata...");
      // Clean up failed output if it exists
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      await runFFmpeg(fallbackOptions, "Fallback (no metadata)");
    }

    const stats = fs.statSync(tempOutputPath);

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
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    return handleControllerError(res, "[DOWNLOAD-FIXED] Error", error, "Failed to process video");
  }
};

export const downloadFixedPublic = async (req: AuthRequest, res: Response) => {
  const tempInputPath = path.join(os.tmpdir(), `dl_input_${Date.now()}.mp4`);
  const tempOutputPath = path.join(os.tmpdir(), `dl_output_${Date.now()}.mp4`);

  try {
    const { url, filename, mode } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing required 'url' parameter" });
    }

    const urlCheck = await validateUserUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.error });
    }

    const rawFilename = typeof filename === "string" ? filename : "video.mp4";
    const outputFilename = rawFilename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

    // Mode: "direct" = stream from S3 directly (fastest)
    //       "remux" = copy streams without re-encoding (fast, fixes metadata)
    //       undefined = full re-encode (slowest but most compatible)
    if (mode === "direct") {
      console.log(`[DOWNLOAD-PUBLIC] Direct proxy: ${url.substring(0, 100)}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      res.setHeader("Content-Type", "video/mp4");
      if (response.headers.get("content-length")) {
        res.setHeader("Content-Length", response.headers.get("content-length")!);
      }
      res.setHeader("Content-Disposition", `attachment; filename="${outputFilename}"`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
      console.log("[DOWNLOAD-PUBLIC] Direct proxy complete");
      return;
    }

    console.log(`[DOWNLOAD-FIXED-PUBLIC] Starting (mode=${mode || "full"}): ${url.substring(0, 100)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(tempInputPath, Buffer.from(arrayBuffer));
    console.log(`[DOWNLOAD-FIXED-PUBLIC] Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);

    const ffmpegOptions = mode === "remux"
      ? [
          "-map_metadata", "-1",
          "-c:v copy",
          "-c:a copy",
          "-movflags +faststart",
          ...generateJumbledMetadata(),
        ]
      : [
          "-map_metadata", "-1",
          ...MOBILE_DOWNLOAD_SETTINGS,
          ...generateJumbledMetadata(),
        ];

    const fallbackOptions = ["-c:v copy", "-c:a copy", "-movflags +faststart"];

    const runFFmpeg = (options: string[], label: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .outputOptions(options)
          .save(tempOutputPath)
          .on("end", () => {
            console.log(`[DOWNLOAD-FIXED-PUBLIC] ${label} complete`);
            resolve();
          })
          .on("error", (err) => {
            console.error(`[DOWNLOAD-FIXED-PUBLIC] ${label} error:`, err.message);
            reject(err);
          });
      });
    };

    try {
      await runFFmpeg(ffmpegOptions, `Processing (mode=${mode || "full"})`);
    } catch (firstError) {
      console.log("[DOWNLOAD-FIXED-PUBLIC] First attempt failed, trying fallback without metadata...");
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
      await runFFmpeg(fallbackOptions, "Fallback (no metadata)");
    }

    const stats = fs.statSync(tempOutputPath);

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
    if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    return handleControllerError(res, "[DOWNLOAD-FIXED-PUBLIC] Error", error, "Failed to process video");
  }
};

/**
 * Detect faces in a video and return time segments where faces appear
 * Uses BlazeFace ML model for detection at 5 fps sampling
 */
export const detectFaces = async (req: AuthRequest, res: Response<{ success: true; segments: { start: number; end: number }[]; videoDuration: number; segmentCount: number } | ErrorResponse>) => {
  const uploadedFile = req.file;

  try {
    const userId = requireUser(req, res);
    if (!userId) return;

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
    return handleControllerError(res, "[FACE-DETECT] Error", error, "Failed to detect faces");
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

/**
 * Get a presigned URL for uploading a video for face detection
 */
export const getDetectFacesUploadUrl = async (req: AuthRequest, res: Response<{ success: true; uploadUrl: string; s3Key: string } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { fileName, teamId } = req.body;

    if (!fileName || !teamId) {
      return res.status(400).json({ error: "Missing required fields: fileName and teamId" });
    }

    console.log(`[FACE-DETECT] Generating presigned upload URL for: ${fileName}`);

    const { uploadUrl, s3Key } = await s3Service.getFaceDetectUploadUrl(
      parseInt(teamId),
      fileName
    );

    return res.status(200).json({
      success: true,
      uploadUrl,
      s3Key,
    });
  } catch (error) {
    return handleControllerError(res, "[FACE-DETECT] Get upload URL error", error, "Failed to get upload URL");
  }
};

/**
 * Detect faces from a video already uploaded to S3
 */
export const detectFacesFromS3 = async (req: AuthRequest, res: Response<{ success: true; segments: { start: number; end: number }[]; videoDuration: number; segmentCount: number } | ErrorResponse>) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { s3Key, videoDuration } = req.body;

    if (!s3Key || videoDuration === undefined) {
      return res.status(400).json({ error: "Missing required fields: s3Key and videoDuration" });
    }

    const duration = parseFloat(videoDuration);
    if (isNaN(duration) || duration <= 0) {
      return res.status(400).json({ error: "Invalid videoDuration" });
    }

    // Validate video isn't too long (prevent abuse)
    const MAX_DETECTION_DURATION = 300; // 5 minutes max
    if (duration > MAX_DETECTION_DURATION) {
      return res.status(400).json({
        error: `Video too long for face detection. Maximum ${MAX_DETECTION_DURATION} seconds allowed.`,
      });
    }

    console.log(`[FACE-DETECT] Starting detection from S3 key: ${s3Key}, duration: ${duration}s`);

    // Run face detection via Lambda
    const segments = await detectFaceSegmentsFromS3Key(s3Key, duration);

    console.log(`[FACE-DETECT] Found ${segments.length} face segments`);

    return res.status(200).json({
      success: true,
      segments,
      videoDuration: duration,
      segmentCount: segments.length,
    });
  } catch (error) {
    return handleControllerError(res, "[FACE-DETECT] Error", error, "Failed to detect faces");
  }
};

export const faceSwapController = {
  trimVideo,
  downloadFixed,
  downloadFixedPublic,
  detectFaces,
  getDetectFacesUploadUrl,
  detectFacesFromS3,
};
