import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import { Response } from "express";
import { ApiKeyRequest, AuthRequest } from "../middleware/auth.middleware";
import { apiBillingService } from "../services/apiBilling.service";
import { clipManagerService } from "../services/clips/clipManager.service";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { videoDownloadService } from "../services/videoDownload.service";
import { API_PRODUCTS } from "../config/api-products";
import { isValidPromptType, PromptType } from "../constants/promptTypes";
import { isValidConversionMode, ConversionMode } from "../constants/conversionModes";
import { ensureOutputDir } from "../utils/fileUtils";
import { verifyTeamAccessOrFail } from "../utils/controllerHelpers";

const CLIP_PRODUCT_SLUG = "clip_save";
const MAX_CLIPS = 10;

const CAPTION_COLORS: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
  red: "#FF0000",
  orange: "#FF6B00",
  yellow: "#FFD600",
  green: "#00FF00",
  teal: "#00D4AA",
  blue: "#0084FF",
  purple: "#7B2CBF",
  pink: "#FF006E",
};

const CAPTION_FONTS = [
  "Montserrat", "Luckiest Guy", "Everlasting", "Komika",
  "Burbank", "Bebas Neue", "Anton",
] as const;

const isValidCaptionFont = (v: string): boolean =>
  CAPTION_FONTS.some((f) => f.toLowerCase() === v.toLowerCase());

const resolveCaptionFont = (v: string): string =>
  CAPTION_FONTS.find((f) => f.toLowerCase() === v.toLowerCase()) || "Montserrat";

/**
 * POST /v1/clip
 *
 * Submit a video for AI clipping. Always responds immediately with a job_id.
 * Accepts either JSON body with video_url or multipart form data with video file.
 * Bills $1.50 per clip upfront from wallet.
 */
export const createClipJobController = async (
  req: ApiKeyRequest,
  res: Response,
) => {
  const { teamId, userId, id: apiKeyId } = req.apiKey!;

  try {
    // --- Resolve video + music sources ---
    const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
    const uploadedFile = files?.video?.[0];
    const uploadedMusic = files?.music?.[0];
    const videoUrl: string | undefined = req.body.video_url;
    const musicUrl: string | undefined = req.body.music_url;

    if (!uploadedFile && !videoUrl) {
      return res.status(400).json({
        error: "Provide either a video_url in JSON or a video file via multipart form data",
      });
    }

    if (uploadedFile && videoUrl) {
      return res.status(400).json({
        error: "Provide either video_url or a file upload, not both",
      });
    }

    if (videoUrl) {
      try {
        new URL(videoUrl);
      } catch {
        return res.status(400).json({ error: "video_url must be a valid URL" });
      }
    }

    // --- Parse options (from body fields — works for both JSON and form data) ---
    const numClips = Math.min(
      Math.max(parseInt(req.body.num_clips) || 1, 1),
      MAX_CLIPS,
    );

    const style = req.body.style;
    const promptType: PromptType =
      style && isValidPromptType(style) ? style : "viral";

    // Captions can come as nested object (JSON) or flat fields (form data)
    const captions = req.body.captions;
    const captionsEnabled =
      (typeof captions === "object"
        ? captions?.enabled
        : req.body.captions_enabled === "true") ?? false;

    const rawColor = (
      typeof captions === "object" ? captions?.color : req.body.captions_color
    ) ?? "white";
    const captionColor = CAPTION_COLORS[rawColor.toLowerCase()];
    if (!captionColor) {
      return res.status(400).json({
        error: `Invalid captions color "${rawColor}". Must be one of: ${Object.keys(CAPTION_COLORS).join(", ")}`,
      });
    }

    // Caption font
    const rawCaptionFont = (
      typeof captions === "object" ? captions?.font : req.body.captions_font
    ) as string | undefined;
    let captionFont: string | undefined;
    if (rawCaptionFont) {
      if (!isValidCaptionFont(rawCaptionFont)) {
        return res.status(400).json({
          error: `Invalid captions font "${rawCaptionFont}". Must be one of: ${CAPTION_FONTS.join(", ")}`,
        });
      }
      captionFont = resolveCaptionFont(rawCaptionFont);
    }

    // Camera mode (conversion mode) — public API accepts "facecam", mapped to internal "gaming"
    const rawCameraMode = req.body.camera_mode;
    let conversionMode: ConversionMode = "standard";
    if (rawCameraMode) {
      const mapped = rawCameraMode === "facecam" ? "gaming" : rawCameraMode;
      if (!isValidConversionMode(mapped)) {
        return res.status(400).json({
          error: `Invalid camera_mode "${rawCameraMode}". Must be one of: standard, facecam, speaker-zoom, center-crop, active-speaker`,
        });
      }
      conversionMode = mapped;
    }

    // Clip length (seconds) — default 40, range 10–180
    const clipLength = Math.min(Math.max(parseInt(req.body.length) || 40, 10), 180);

    // Custom prompt — additional AI instructions for clip selection
    const prompt: string | undefined = req.body.prompt || undefined;

    // Auto heading (default true — generates a viral heading per clip)
    const autoHeading = req.body.auto_heading !== false && req.body.auto_heading !== "false";

    // Heading style customization (nested object or flat fields)
    const headingParam = req.body.heading;
    const rawHeadingStyle = (
      typeof headingParam === "object" ? headingParam?.style : req.body.heading_style
    ) as string | undefined;
    let textStyle: "stroke" | "instagram" = "stroke";
    if (rawHeadingStyle) {
      if (!["stroke", "instagram"].includes(rawHeadingStyle)) {
        return res.status(400).json({
          error: `Invalid heading style "${rawHeadingStyle}". Must be one of: stroke, instagram`,
        });
      }
      textStyle = rawHeadingStyle as "stroke" | "instagram";
    }

    const rawHeadingColor = (
      typeof headingParam === "object" ? headingParam?.color : req.body.heading_color
    ) as string | undefined;
    let textColor: string | undefined;
    if (rawHeadingColor) {
      const resolved = CAPTION_COLORS[rawHeadingColor.toLowerCase()];
      if (!resolved) {
        return res.status(400).json({
          error: `Invalid heading color "${rawHeadingColor}". Must be one of: ${Object.keys(CAPTION_COLORS).join(", ")}`,
        });
      }
      textColor = resolved;
    }

    const rawHeadingFont = (
      typeof headingParam === "object" ? headingParam?.font : req.body.heading_font
    ) as string | undefined;
    let textFont: string | undefined;
    if (rawHeadingFont) {
      if (!isValidCaptionFont(rawHeadingFont)) {
        return res.status(400).json({
          error: `Invalid heading font "${rawHeadingFont}". Must be one of: ${CAPTION_FONTS.join(", ")}`,
        });
      }
      textFont = resolveCaptionFont(rawHeadingFont);
    }

    // Custom heading text (takes priority over auto_heading)
    const customText: string | undefined = (
      typeof headingParam === "object" ? headingParam?.text : req.body.heading_text
    ) || undefined;

    // Heading position (default top)
    const rawHeadingPosition = (
      typeof headingParam === "object" ? headingParam?.position : req.body.heading_position
    ) as string | undefined;
    let textPosition: "top" | "bottom" | "middle" | undefined;
    if (rawHeadingPosition) {
      if (!["top", "middle", "bottom"].includes(rawHeadingPosition)) {
        return res.status(400).json({
          error: `Invalid heading position "${rawHeadingPosition}". Must be one of: top, middle, bottom`,
        });
      }
      textPosition = rawHeadingPosition as "top" | "bottom" | "middle";
    }

    // Hook length (seconds) — default undefined (AI decides, typically 6s)
    const rawHookLength = parseInt(req.body.hook_length);
    let hookLength: number | undefined;
    if (!isNaN(rawHookLength)) {
      if (rawHookLength < 2 || rawHookLength > 15) {
        return res.status(400).json({
          error: `Invalid hook_length "${rawHookLength}". Must be between 2 and 15 seconds.`,
        });
      }
      hookLength = rawHookLength;
    }

    // --- Background music ---
    let backgroundMusicS3Key: string | undefined;
    try {
      if (uploadedMusic) {
        backgroundMusicS3Key = await s3Service.uploadRawVideo(uploadedMusic.path, teamId);
      } else if (musicUrl) {
        try {
          new URL(musicUrl);
        } catch {
          return res.status(400).json({ error: "music_url must be a valid URL" });
        }
        const outDir = ensureOutputDir();
        const musicTempPath = path.join(outDir, `api_music_${Date.now()}.mp3`);
        await videoDownloadService.downloadToPath(musicUrl, musicTempPath);
        backgroundMusicS3Key = await s3Service.uploadRawVideo(musicTempPath, teamId);
        if (fs.existsSync(musicTempPath)) fs.unlinkSync(musicTempPath);
      }
    } catch (musicErr) {
      console.warn("Failed to process background music:", musicErr);
    }

    // --- Check balance upfront ---
    const product = API_PRODUCTS[CLIP_PRODUCT_SLUG];
    const totalCostCents = product.priceCents * numClips;

    const account = await apiBillingService.getAccount(teamId);
    if (!account || account.balance_cents < totalCostCents) {
      return res.status(402).json({
        error: "Insufficient wallet balance",
        required_cents: totalCostCents,
        balance_cents: account?.balance_cents ?? 0,
      });
    }

    // --- Create job (raw video record serves as the job container) ---
    const rawVideo = await clipManagerService.createRawVideo({
      teamId,
      videoPath: videoUrl || uploadedFile!.originalname || "pending_upload",
    });

    // --- Create pending clips linked to job ---
    const clipIds: number[] = [];
    for (let i = 0; i < numClips; i++) {
      const clip = await clipManagerService.createPendingClip({
        teamId, userId, rawVideoId: rawVideo.id,
      });
      clipIds.push(clip.id);
    }

    // --- Bill ---
    for (const clipId of clipIds) {
      await apiBillingService.consume(
        apiKeyId, teamId, CLIP_PRODUCT_SLUG,
        "/v1/clip", "POST", 200,
        undefined, { clipId, jobId: rawVideo.public_id },
      );
    }

    // --- Respond immediately ---
    res.json({
      job_id: rawVideo.public_id,
      num_clips: numClips,
      cost_cents: totalCostCents,
      status: "processing",
    });

    // --- Process in background ---
    processInBackground({
      teamId, userId, clipIds, numClips, promptType,
      captionsEnabled, captionColor, captionFont, conversionMode,
      clipLength, prompt, autoHeading, hookLength,
      textStyle, textColor, textFont, textPosition, customText,
      backgroundMusicS3Key,
      originalFileName: uploadedFile?.originalname,
      fileSize: uploadedFile?.size,
      localVideoPath: uploadedFile?.path,
      localMusicPath: uploadedMusic?.path,
      videoUrl,
    });
  } catch (err) {
    if (res.headersSent) {
      console.error("Error after response sent in createClipJobController:", err);
      Sentry.captureException(err);
      return;
    }
    console.error("Error in createClipJobController:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to create clip job" });
  }
};

/**
 * GET /v1/clip/:jobId
 *
 * Poll a job's status. Returns clip download URLs when complete.
 */
export const getClipJobStatusController = async (
  req: ApiKeyRequest,
  res: Response,
) => {
  const { teamId } = req.apiKey!;
  const jobId = req.params.jobId;

  if (!jobId) {
    return res.status(400).json({ error: "Missing job ID" });
  }

  try {
    const jobClips = await clipManagerService.getClipsByPublicId(jobId, teamId);

    if (jobClips.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const response = await buildJobResponse(jobId, jobClips);

    return res.json(response);
  } catch (err) {
    console.error("Error in getClipJobStatusController:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get job status" });
  }
};

async function buildJobResponse(jobId: string, jobClips: any[]) {
  const total = jobClips.length;
  const done = jobClips.filter((c) => c.status !== "pending");

  if (done.length < total) {
    return {
      job_id: jobId,
      status: "processing",
      progress: { completed: done.length, total },
    };
  }

  const clips = await Promise.all(
    jobClips.map(async (clip) => {
      if (clip.status === "completed" && clip.clip_path) {
        const heading = clip.clip_metadata?.editorConfig?.heading?.text;
        return {
          clip_id: clip.id,
          status: "completed",
          title: clip.title,
          ...(heading ? { heading } : {}),
          download_url: await s3Service.getPresignedUrl(clip.clip_path, 604800),
          created_at: clip.created_at,
        };
      }
      return {
        clip_id: clip.id,
        status: "failed",
        error: clip.error_message ?? "Processing failed",
        created_at: clip.created_at,
      };
    }),
  );

  return { job_id: jobId, status: "completed", clips };
}

// -------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------

/** Upload local file to S3 and dispatch SQS job */
async function uploadAndDispatch(params: {
  teamId: number;
  userId: number;
  clipIds: number[];
  localVideoPath: string;
  numClips: number;
  promptType: PromptType;
  captionsEnabled: boolean;
  captionColor: string;
  captionFont?: string;
  conversionMode: ConversionMode;
  clipLength: number;
  prompt?: string;
  autoHeading: boolean;
  hookLength?: number;
  textStyle?: "stroke" | "instagram";
  textColor?: string;
  textFont?: string;
  textPosition?: "top" | "bottom" | "middle";
  customText?: string;
  backgroundMusicS3Key?: string;
  originalFileName?: string;
  fileSize?: number;
}) {
  const {
    teamId, userId, clipIds, localVideoPath,
    numClips, promptType, captionsEnabled, captionColor, captionFont,
    conversionMode, clipLength, prompt, autoHeading, hookLength,
    textStyle, textColor, textFont, textPosition, customText, backgroundMusicS3Key,
    originalFileName, fileSize,
  } = params;

  const s3Key = await s3Service.uploadRawVideo(localVideoPath, teamId);

  await sqsService.sendClipVideoJob({
    clipIds,
    teamId,
    userId,
    s3Key,
    options: {
      numberOfVideos: numClips,
      length: clipLength,
      hookLength,
      promptType,
      textPrompt: prompt,
      captions: captionsEnabled,
      captionColor,
      captionFont,
      conversionMode,
      autoHeading,
      textStyle,
      textColor,
      textFont,
      textPosition,
      customText,
      backgroundMusicS3Key,
    },
    originalFileName,
    fileSize,
  });
}

/** Fire-and-forget: download/upload video and dispatch. Refunds on failure. */
function processInBackground(params: {
  teamId: number;
  userId: number;
  clipIds: number[];
  numClips: number;
  promptType: PromptType;
  captionsEnabled: boolean;
  captionColor: string;
  captionFont?: string;
  conversionMode: ConversionMode;
  clipLength: number;
  prompt?: string;
  autoHeading: boolean;
  hookLength?: number;
  textStyle?: "stroke" | "instagram";
  textColor?: string;
  textFont?: string;
  textPosition?: "top" | "bottom" | "middle";
  customText?: string;
  backgroundMusicS3Key?: string;
  originalFileName?: string;
  fileSize?: number;
  localVideoPath?: string;
  localMusicPath?: string;
  videoUrl?: string;
}) {
  const { teamId, clipIds, numClips, videoUrl, localVideoPath, localMusicPath } = params;

  (async () => {
    let tempPath: string | undefined;

    try {
      let videoFilePath: string;

      if (localVideoPath) {
        videoFilePath = localVideoPath;
      } else {
        const outDir = ensureOutputDir();
        tempPath = path.join(outDir, `api_download_${Date.now()}.mp4`);
        await videoDownloadService.downloadToPath(videoUrl!, tempPath);
        videoFilePath = tempPath;
      }

      await uploadAndDispatch({
        teamId: params.teamId,
        userId: params.userId,
        clipIds: params.clipIds,
        localVideoPath: videoFilePath,
        numClips: params.numClips,
        promptType: params.promptType,
        captionsEnabled: params.captionsEnabled,
        captionColor: params.captionColor,
        captionFont: params.captionFont,
        conversionMode: params.conversionMode,
        clipLength: params.clipLength,
        prompt: params.prompt,
        autoHeading: params.autoHeading,
        hookLength: params.hookLength,
        textStyle: params.textStyle,
        textColor: params.textColor,
        textFont: params.textFont,
        textPosition: params.textPosition,
        customText: params.customText,
        backgroundMusicS3Key: params.backgroundMusicS3Key,
        originalFileName: params.originalFileName,
        fileSize: params.fileSize,
      });
    } catch (err) {
      console.error("Background processing failed:", err);
      Sentry.captureException(err);

      const refundCents = API_PRODUCTS[CLIP_PRODUCT_SLUG].priceCents * numClips;
      await apiBillingService.topUp(teamId, refundCents).catch((e) =>
        console.error("Failed to refund:", e),
      );

      for (const clipId of clipIds) {
        await clipManagerService.updateClipStatus(clipId, teamId, "failed",
          videoUrl ? "Failed to download video from URL" : "Failed to process uploaded video",
        ).catch(() => {});
      }
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      if (localVideoPath && fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
      if (localMusicPath && fs.existsSync(localMusicPath)) fs.unlinkSync(localMusicPath);
    }
  })();
}

/**
 * GET /platform/teams/:teamId/jobs/clip/:jobId
 * Bearer-auth version of getClipJobStatusController for the dashboard.
 */
export const getClipJobStatusBearerController = async (
  req: AuthRequest,
  res: Response,
) => {
  const teamId = parseInt(req.params.teamId);
  const jobId = req.params.jobId;

  if (!jobId || isNaN(teamId)) {
    return res.status(400).json({ error: "Missing job ID or team ID" });
  }

  const team = await verifyTeamAccessOrFail(req, teamId, res);
  if (!team) return;

  try {
    const jobClips = await clipManagerService.getClipsByPublicId(jobId, teamId);

    if (jobClips.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    const response = await buildJobResponse(jobId, jobClips);
    return res.json(response);
  } catch (err) {
    console.error("Error in getClipJobStatusBearerController:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get job status" });
  }
};
