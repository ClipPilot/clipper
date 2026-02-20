import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import { Response } from "express";
import { ApiKeyRequest } from "../middleware/auth.middleware";
import { apiBillingService } from "../services/apiBilling.service";
import { clipManagerService } from "../services/clips/clipManager.service";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { videoDownloadService } from "../services/videoDownload.service";
import { API_PRODUCTS } from "../config/api-products";
import { isValidPromptType, PromptType } from "../constants/promptTypes";
import { ensureOutputDir } from "../utils/fileUtils";

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
    // --- Resolve video source ---
    const uploadedFile = (req as any).file as Express.Multer.File | undefined;
    const videoUrl: string | undefined = req.body.video_url;

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
        undefined, { clipId, jobId: rawVideo.id },
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
      captionsEnabled, captionColor,
      originalFileName: uploadedFile?.originalname,
      fileSize: uploadedFile?.size,
      localVideoPath: uploadedFile?.path,
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
        return {
          clip_id: clip.id,
          status: "completed",
          title: clip.title,
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
  originalFileName?: string;
  fileSize?: number;
}) {
  const {
    teamId, userId, clipIds, localVideoPath,
    numClips, promptType, captionsEnabled, captionColor,
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
      promptType,
      captions: captionsEnabled,
      captionColor,
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
  originalFileName?: string;
  fileSize?: number;
  localVideoPath?: string;
  videoUrl?: string;
}) {
  const { teamId, clipIds, numClips, videoUrl, localVideoPath } = params;

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
    }
  })();
}
