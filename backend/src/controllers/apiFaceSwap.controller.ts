import * as Sentry from "@sentry/node";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Response } from "express";
import { eq } from "drizzle-orm";
import { ApiKeyRequest, AuthRequest } from "../middleware/auth.middleware";
import { verifyTeamAccessOrFail } from "../utils/controllerHelpers";
import { apiBillingService } from "../services/apiBilling.service";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { detectFaceSegmentsWithPadding } from "../services/face-swap/faceDetection.service";
import {
  getVideoDuration,
  cutClip,
} from "../services/clips/videoEditor.service";
import { createSceneAwareChunks } from "../services/ai-ugc/sceneChunker.service";
import { db } from "../db";
import { comfyJobs, clips } from "@clipper/shared-db/src/schema";
import { API_PRODUCTS } from "../config/api-products";
import { ensureOutputDir } from "../utils/fileUtils";
import { TEMP_DIR } from "../utils/tempCleanup";
import { videoDownloadService } from "../services/videoDownload.service";

const FACE_SWAP_PRODUCT_SLUG = "face_swap";
const MAX_DURATION_SECONDS = 300;
const KLING_CHUNK_DURATION = 25;
const KLING_CHUNK_LEEWAY = 5;
const MIN_SEGMENT_DURATION = 3;

type FaceSwapMode = "face" | "fullbody";

// -------------------------------------------------------------------
// Splice segment calculation (duplicated from comfy.controller.ts)
// -------------------------------------------------------------------
interface SegmentInput {
  start: number;
  end: number;
}

interface SpliceSegment {
  start: number;
  end: number;
  type: "processed" | "original";
  chunkCount?: number;
}

function calculateSpliceSegments(
  segments: SegmentInput[],
  videoDuration: number,
): SpliceSegment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const result: SpliceSegment[] = [];

  if (sorted[0].start > 0.1) {
    result.push({ start: 0, end: sorted[0].start, type: "original" });
  }

  for (let i = 0; i < sorted.length; i++) {
    result.push({
      start: sorted[i].start,
      end: sorted[i].end,
      type: "processed",
    });
    if (i < sorted.length - 1 && sorted[i].end < sorted[i + 1].start - 0.1) {
      result.push({
        start: sorted[i].end,
        end: sorted[i + 1].start,
        type: "original",
      });
    }
  }

  if (sorted[sorted.length - 1].end < videoDuration - 0.1) {
    result.push({
      start: sorted[sorted.length - 1].end,
      end: videoDuration,
      type: "original",
    });
  }

  return result;
}

// -------------------------------------------------------------------
// POST /v1/face-swap
// -------------------------------------------------------------------
export const createFaceSwapJobController = async (
  req: ApiKeyRequest,
  res: Response,
) => {
  const { teamId, userId, id: apiKeyId } = req.apiKey!;

  try {
    // --- Resolve video source ---
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const videoFile = files?.video?.[0];
    const faceImageFile = files?.face_image?.[0];
    const videoUrl: string | undefined = req.body.video_url;
    const faceImageUrl: string | undefined = req.body.face_image_url;

    // Validate: exactly one video source
    if (!videoFile && !videoUrl) {
      return res.status(400).json({
        error: "Provide either a video_url or a video file via multipart form data",
      });
    }
    if (videoFile && videoUrl) {
      return res.status(400).json({
        error: "Provide either video_url or a video file upload, not both",
      });
    }

    // Validate: exactly one face image source
    if (!faceImageFile && !faceImageUrl) {
      return res.status(400).json({
        error: "Provide either a face_image_url or a face_image file via multipart form data",
      });
    }
    if (faceImageFile && faceImageUrl) {
      return res.status(400).json({
        error: "Provide either face_image_url or a face_image file upload, not both",
      });
    }

    // Validate URLs
    if (videoUrl) {
      try { new URL(videoUrl); } catch {
        return res.status(400).json({ error: "video_url must be a valid URL" });
      }
    }
    if (faceImageUrl) {
      try { new URL(faceImageUrl); } catch {
        return res.status(400).json({ error: "face_image_url must be a valid URL" });
      }
    }

    // Validate mode
    const rawMode = req.body.mode || "fullbody";
    if (rawMode !== "face" && rawMode !== "fullbody") {
      return res.status(400).json({
        error: 'mode must be "face" or "fullbody"',
      });
    }
    const mode: FaceSwapMode = rawMode;

    // --- Acquire video locally ---
    const tempFiles: string[] = [];
    let localVideoPath: string;

    if (videoFile) {
      localVideoPath = videoFile.path;
      tempFiles.push(localVideoPath);
    } else {
      const outDir = ensureOutputDir();
      localVideoPath = path.join(outDir, `api_faceswap_download_${Date.now()}.mp4`);
      try {
        await videoDownloadService.downloadToPath(videoUrl!, localVideoPath);
      } catch (err) {
        return res.status(400).json({ error: "Failed to download video from video_url" });
      }
      tempFiles.push(localVideoPath);
    }

    // --- Acquire face image locally ---
    let localFaceImagePath: string;

    if (faceImageFile) {
      localFaceImagePath = faceImageFile.path;
      tempFiles.push(localFaceImagePath);
    } else {
      const outDir = ensureOutputDir();
      localFaceImagePath = path.join(outDir, `api_faceswap_face_${Date.now()}.jpg`);
      try {
        await s3Service.downloadVideoFromUrl(faceImageUrl!, localFaceImagePath);
      } catch (err) {
        cleanupFiles(tempFiles);
        return res.status(400).json({ error: "Failed to download image from face_image_url" });
      }
      tempFiles.push(localFaceImagePath);
    }

    // --- Get video duration ---
    let duration: number;
    try {
      duration = await getVideoDuration(localVideoPath);
    } catch (err) {
      cleanupFiles(tempFiles);
      return res.status(400).json({ error: "Could not read video duration. Ensure the file is a valid video." });
    }

    if (duration > MAX_DURATION_SECONDS) {
      cleanupFiles(tempFiles);
      return res.status(400).json({
        error: `Video duration ${Math.ceil(duration)}s exceeds maximum of ${MAX_DURATION_SECONDS}s`,
      });
    }

    // --- Calculate cost ---
    const durationSeconds = Math.ceil(duration);
    const product = API_PRODUCTS[FACE_SWAP_PRODUCT_SLUG];
    const totalCostCents = durationSeconds * product.priceCents;

    // --- Check wallet balance ---
    const account = await apiBillingService.getAccount(teamId);
    if (!account || account.balance_cents < totalCostCents) {
      cleanupFiles(tempFiles);
      return res.status(402).json({
        error: "Insufficient wallet balance",
        required_cents: totalCostCents,
        balance_cents: account?.balance_cents ?? 0,
      });
    }

    // --- Create comfy_jobs record ---
    const jobId = crypto.randomUUID();
    await db.insert(comfyJobs).values({
      id: jobId,
      teamId,
      status: "pending_upload",
      imageFile: "pending",
      videoFile: "pending",
      jobType: "api-face-swap",
      progress: 0,
      progressMessage: "Initializing",
    });

    // --- Bill upfront ---
    await apiBillingService.consumeAmount(
      apiKeyId,
      teamId,
      FACE_SWAP_PRODUCT_SLUG,
      totalCostCents,
      durationSeconds,
      "/v1/face-swap",
      "POST",
      202,
      undefined,
      { jobId, mode, durationSeconds },
    );

    // --- Respond 202 immediately ---
    res.status(202).json({
      job_id: jobId,
      mode,
      duration_seconds: durationSeconds,
      cost_cents: totalCostCents,
      status: "processing",
    });

    // --- Fire-and-forget background processing ---
    processBackgroundFaceSwap({
      jobId,
      teamId,
      userId,
      mode,
      localVideoPath,
      localFaceImagePath,
      duration,
      totalCostCents,
      tempFiles,
    });
  } catch (err) {
    if (res.headersSent) {
      console.error("[api-face-swap] Error after response sent:", err);
      Sentry.captureException(err);
      return;
    }
    console.error("[api-face-swap] Error in createFaceSwapJobController:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to create face swap job" });
  }
};

// -------------------------------------------------------------------
// GET /v1/face-swap/:jobId
// -------------------------------------------------------------------
export const getFaceSwapStatusController = async (
  req: ApiKeyRequest,
  res: Response,
) => {
  const { teamId } = req.apiKey!;
  const jobId = req.params.jobId;

  if (!jobId) {
    return res.status(400).json({ error: "Missing job ID" });
  }

  try {
    const [job] = await db
      .select()
      .from(comfyJobs)
      .where(eq(comfyJobs.id, jobId))
      .limit(1);

    if (!job || job.teamId !== teamId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const response = await buildFaceSwapStatusResponse(job);

    return res.json(response);
  } catch (err) {
    console.error("[api-face-swap] Error in getFaceSwapStatusController:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get job status" });
  }
};

// -------------------------------------------------------------------
// Background processing
// -------------------------------------------------------------------
function processBackgroundFaceSwap(params: {
  jobId: string;
  teamId: number;
  userId: number;
  mode: FaceSwapMode;
  localVideoPath: string;
  localFaceImagePath: string;
  duration: number;
  totalCostCents: number;
  tempFiles: string[];
}) {
  const {
    jobId, teamId, userId, mode,
    localVideoPath, localFaceImagePath,
    duration, totalCostCents, tempFiles,
  } = params;

  (async () => {
    const additionalTempFiles: string[] = [];

    try {
      // Upload video + image to S3
      const videoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_api_faceswap.mp4`;
      const imageExt = path.extname(localFaceImagePath) || ".jpg";
      const imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_api_faceswap${imageExt}`;

      const videoBuffer = fs.readFileSync(localVideoPath);
      const imageBuffer = fs.readFileSync(localFaceImagePath);

      await Promise.all([
        s3Service.uploadBuffer(videoBuffer, videoS3Key, "video/mp4"),
        s3Service.uploadBuffer(imageBuffer, imageS3Key, "image/jpeg"),
      ]);

      await db
        .update(comfyJobs)
        .set({ videoFile: videoS3Key, imageFile: imageS3Key })
        .where(eq(comfyJobs.id, jobId));

      await processFullbodyMode({
        jobId, teamId, userId, videoS3Key, imageS3Key,
        localVideoPath, duration, additionalTempFiles,
        swapType: mode,
      });
    } catch (err) {
      console.error(`[api-face-swap] Background processing failed for job ${jobId}:`, err);
      Sentry.captureException(err);

      // Refund
      await apiBillingService.topUp(teamId, totalCostCents).catch((e) =>
        console.error("[api-face-swap] Failed to refund:", e),
      );

      // Mark job failed
      await db
        .update(comfyJobs)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "Face swap processing failed",
          finishedAt: new Date(),
        })
        .where(eq(comfyJobs.id, jobId))
        .catch(() => {});
    } finally {
      for (const f of [...tempFiles, ...additionalTempFiles]) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      }
    }
  })();
}

// -------------------------------------------------------------------
// Face mode (FAL AI — in-process)
// -------------------------------------------------------------------
// -------------------------------------------------------------------
// Process mode (SQS worker — Kling for fullbody, WaveSpeed for face)
// -------------------------------------------------------------------
async function processFullbodyMode(params: {
  jobId: string;
  teamId: number;
  userId: number;
  videoS3Key: string;
  imageS3Key: string;
  localVideoPath: string;
  duration: number;
  additionalTempFiles: string[];
  swapType?: "face" | "fullbody";
}) {
  const {
    jobId, teamId, userId, videoS3Key, imageS3Key,
    localVideoPath, duration, additionalTempFiles,
    swapType = "fullbody",
  } = params;

  await db
    .update(comfyJobs)
    .set({ status: "pending_upload", progress: 0, progressMessage: "Detecting faces in video..." })
    .where(eq(comfyJobs.id, jobId));

  // Detect face segments
  const detectedSegments = await detectFaceSegmentsWithPadding(localVideoPath, duration);
  if (detectedSegments.length === 0) {
    throw new Error("No faces detected in video");
  }

  // Select segments (max 300s total, max 5 segments)
  let selectedSegments: SegmentInput[] = [];
  let totalDur = 0;
  const maxSegments = 5;

  for (const seg of detectedSegments) {
    if (selectedSegments.length >= maxSegments) break;
    const segDuration = seg.end - seg.start;
    if (totalDur + segDuration <= MAX_DURATION_SECONDS) {
      selectedSegments.push({ start: seg.start, end: seg.end });
      totalDur += segDuration;
    } else if (totalDur < MAX_DURATION_SECONDS) {
      const availableDuration = MAX_DURATION_SECONDS - totalDur;
      if (availableDuration >= 0.5) {
        selectedSegments.push({ start: seg.start, end: seg.start + availableDuration });
      }
      break;
    }
  }

  if (selectedSegments.length === 0) {
    throw new Error("No usable face segments found");
  }

  // 3-second minimum only applies to fullbody (Kling/fal), not face swap (WaveSpeed)
  if (swapType !== "face") {
    const shortSegments = selectedSegments.filter(
      (seg) => seg.end - seg.start < MIN_SEGMENT_DURATION,
    );
    if (shortSegments.length > 0) {
      throw new Error(`Detected segments are too short. All face segments must be at least ${MIN_SEGMENT_DURATION} seconds long.`);
    }
  }

  const segments = selectedSegments.sort((a, b) => a.start - b.start);

  await db
    .update(comfyJobs)
    .set({ progressMessage: "Processing video segments..." })
    .where(eq(comfyJobs.id, jobId));

  // Cut segments and create chunks
  const segmentPaths: string[] = [];
  const chunkPaths: string[] = [];
  const chunkCountsPerSegment: number[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segPath = path.join(TEMP_DIR, `${crypto.randomUUID()}_api_segment_${i}.mp4`);
    await cutClip(localVideoPath, segPath, segments[i].start, segments[i].end);
    segmentPaths.push(segPath);
    additionalTempFiles.push(segPath);

    const segmentChunks = await createSceneAwareChunks(segPath, TEMP_DIR, {
      targetDuration: KLING_CHUNK_DURATION,
      leeway: KLING_CHUNK_LEEWAY,
    });
    chunkCountsPerSegment.push(segmentChunks.length);
    chunkPaths.push(...segmentChunks);
    additionalTempFiles.push(...segmentChunks);
  }

  // Upload chunks to S3
  const chunkS3Keys: string[] = [];
  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkBuffer = fs.readFileSync(chunkPaths[i]);
    const chunkS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_api_chunk_${i}.mp4`;
    chunkS3Keys.push(chunkS3Key);
    await s3Service.uploadBuffer(chunkBuffer, chunkS3Key, "video/mp4");
  }

  // Always splice in fullbody mode so the output is the full video
  // (not just the detected face segments)
  const isSpliceMode = duration > 0;
  let originalVideoS3Key: string | undefined;

  if (isSpliceMode) {
    originalVideoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_api_original.mp4`;
    const originalBuffer = fs.readFileSync(localVideoPath);
    await s3Service.uploadBuffer(originalBuffer, originalVideoS3Key, "video/mp4");
  }

  // Build splice metadata
  let spliceMetadata: { videoDuration: number; segments: SpliceSegment[] } | null = null;
  if (isSpliceMode) {
    const spliceSegments = calculateSpliceSegments(segments, duration);
    let processedSegmentIndex = 0;
    for (const seg of spliceSegments) {
      if (seg.type === "processed") {
        seg.chunkCount = chunkCountsPerSegment[processedSegmentIndex];
        processedSegmentIndex++;
      }
    }
    spliceMetadata = { videoDuration: duration, segments: spliceSegments };
  }

  // Update job record
  await db
    .update(comfyJobs)
    .set({
      status: "queued",
      imageFile: imageS3Key,
      videoFile: chunkS3Keys[0],
      originalVideoS3Key: originalVideoS3Key,
      spliceMode: isSpliceMode,
      spliceMetadata: spliceMetadata || undefined,
      progressMessage: "Waiting for worker",
    })
    .where(eq(comfyJobs.id, jobId));

  // Send to SQS worker
  await sqsService.sendKlingFaceSwapJob({
    jobId,
    teamId,
    userId,
    imageS3Key,
    chunkS3Keys,
    originalVideoS3Key,
    segments,
    videoDuration: duration,
    spliceMode: isSpliceMode,
    spliceMetadata: spliceMetadata || undefined,
    swapType,
  });

  console.log(`[api-face-swap] Job ${jobId} sent to worker queue (${swapType}, ${chunkS3Keys.length} chunks)`);
}

// -------------------------------------------------------------------
// Status response builder
// -------------------------------------------------------------------
async function buildFaceSwapStatusResponse(job: typeof comfyJobs.$inferSelect) {
  const base = {
    job_id: job.id,
    created_at: job.createdAt,
  };

  if (job.status === "completed") {
    const download_url = job.outputFile
      ? await s3Service.getPresignedUrl(job.outputFile, 604800)
      : null;
    return { ...base, status: "completed" as const, download_url };
  }

  if (job.status === "failed") {
    return {
      ...base,
      status: "failed" as const,
      error: job.errorMessage ?? "Processing failed",
    };
  }

  // pending_upload, queued, running → processing
  return {
    ...base,
    status: "processing" as const,
    progress: job.progress ?? 0,
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function cleanupFiles(files: string[]) {
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
  }
}

/**
 * GET /platform/teams/:teamId/jobs/face-swap/:jobId
 * Bearer-auth version of getFaceSwapStatusController for the dashboard.
 */
export const getFaceSwapStatusBearerController = async (
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
    const [job] = await db
      .select()
      .from(comfyJobs)
      .where(eq(comfyJobs.id, jobId))
      .limit(1);

    if (!job || job.teamId !== teamId) {
      return res.status(404).json({ error: "Job not found" });
    }

    const response = await buildFaceSwapStatusResponse(job);
    return res.json(response);
  } catch (err) {
    console.error("[api-face-swap] Error in getFaceSwapStatusBearerController:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get job status" });
  }
};
