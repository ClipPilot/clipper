import * as Sentry from "@sentry/node";
import { db } from "../db";
import { comfyJobs } from "@clipper/shared-db/src/schema";
import { s3Service } from "./s3.service";
import { sqsService } from "./sqs.service";
import {
  cutClip,
  getVideoDuration,
} from "./clips/videoEditor.service";
import { createSceneAwareChunks } from "./ai-ugc/sceneChunker.service";
import { detectFaceSegmentsWithPadding } from "./face-swap/faceDetection.service";
import { emitComfyJobUpdate } from "./socket.service";
import { teamService } from "./team.service";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";
import { UGC_CREDIT_COST } from "../constants/credits";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { TEMP_DIR } from "../utils/tempCleanup";

const MIN_SEGMENT_DURATION = 3;
const KLING_CHUNK_DURATION = 25;
const KLING_CHUNK_LEEWAY = 5;

export interface SegmentInput {
  start: number;
  end: number;
}

export interface SpliceSegment {
  start: number;
  end: number;
  type: "processed" | "original";
  chunkCount?: number;
}

const idempotencyCache = new Map<
  string,
  { jobId: string; expiresAt: number }
>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function cleanExpiredIdempotencyKeys() {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now > value.expiresAt) {
      idempotencyCache.delete(key);
    }
  }
}

setInterval(cleanExpiredIdempotencyKeys, 60 * 1000);

export function checkIdempotency(
  key: string,
): { jobId: string } | null {
  const cached = idempotencyCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return { jobId: cached.jobId };
  }
  return null;
}

export function setIdempotency(key: string, jobId: string): void {
  idempotencyCache.set(key, {
    jobId,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}

export function calculateSpliceSegments(
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

export interface ProcessBackgroundUploadParams {
  jobIds: string[];
  teamId: number;
  userId: number;
  videoPath: string;
  imageSources: Array<{ type: "file" | "s3key"; value: string }>;
  segments: SegmentInput[];
  videoDuration: number;
  spliceWithOriginal: boolean;
  autoDetect: boolean;
  folderId?: number;
  voiceIds?: (string | null | undefined)[];
  swapType?: "face" | "fullbody";
}

export async function processBackgroundUpload(
  params: ProcessBackgroundUploadParams,
) {
  const {
    jobIds,
    teamId,
    userId,
    videoPath,
    imageSources,
    spliceWithOriginal,
    autoDetect,
    folderId,
    voiceIds,
    swapType = "fullbody",
  } = params;

  let { segments, videoDuration } = params;

  const segmentPaths: string[] = [];
  const chunkPaths: string[] = [];
  const MAX_VIDEO_DURATION = 300;

  try {
    console.log(
      `[comfy] Starting background upload for ${jobIds.length} jobs (swapType=${swapType}, autoDetect=${autoDetect})`,
    );

    if (autoDetect) {
      for (const jobId of jobIds) {
        emitComfyJobUpdate(teamId, {
          id: jobId,
          status: "pending_upload",
          progress: 0,
          progressMessage: "Detecting faces in video...",
          outputUrl: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          finishedAt: null,
        });
      }

      videoDuration = await getVideoDuration(videoPath);
      console.log(`[comfy] Video duration: ${videoDuration}s`);

      const detectedSegments = await detectFaceSegmentsWithPadding(
        videoPath,
        videoDuration,
        swapType,
      );
      console.log(
        `[comfy] Detected ${detectedSegments.length} face segments`,
      );

      if (detectedSegments.length === 0) {
        throw new Error("No faces detected in video");
      }

      let selectedSegments: SegmentInput[] = [];
      let totalDur = 0;
      const maxSegments = 5;

      for (const seg of detectedSegments) {
        if (selectedSegments.length >= maxSegments) break;
        const segDuration = seg.end - seg.start;
        if (totalDur + segDuration <= MAX_VIDEO_DURATION) {
          selectedSegments.push({ start: seg.start, end: seg.end });
          totalDur += segDuration;
        } else if (totalDur < MAX_VIDEO_DURATION) {
          const availableDuration = MAX_VIDEO_DURATION - totalDur;
          if (availableDuration >= 0.5) {
            selectedSegments.push({
              start: seg.start,
              end: seg.start + availableDuration,
            });
          }
          break;
        }
      }

      if (selectedSegments.length === 0) {
        throw new Error("No usable face segments found");
      }

      if (swapType !== "face") {
        const shortSegments = selectedSegments.filter(
          (seg) => seg.end - seg.start < MIN_SEGMENT_DURATION,
        );
        if (shortSegments.length > 0) {
          throw new Error(
            `Detected segments are too short. All face segments must be at least ${MIN_SEGMENT_DURATION} seconds long.`,
          );
        }
      }

      segments = selectedSegments.sort((a, b) => a.start - b.start);
      console.log(
        `[comfy] Using ${segments.length} segments (${totalDur.toFixed(1)}s total)`,
      );

      for (const jobId of jobIds) {
        emitComfyJobUpdate(teamId, {
          id: jobId,
          status: "pending_upload",
          progress: 0,
          progressMessage: "Processing video segments...",
          outputUrl: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          finishedAt: null,
        });
      }
    }

    const chunkDuration = KLING_CHUNK_DURATION;
    const chunkLeeway = KLING_CHUNK_LEEWAY;

    console.log(`[comfy] Routing to Kling (chunk: ${chunkDuration}s)`);

    const chunkCountsPerSegment: number[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segPath = path.join(
        TEMP_DIR,
        `${crypto.randomUUID()}_segment_${i}.mp4`,
      );
      await cutClip(videoPath, segPath, segments[i].start, segments[i].end);
      segmentPaths.push(segPath);

      const segmentChunks = await createSceneAwareChunks(segPath, TEMP_DIR, {
        targetDuration: chunkDuration,
        leeway: chunkLeeway,
      });

      chunkCountsPerSegment.push(segmentChunks.length);
      chunkPaths.push(...segmentChunks);
    }

    console.log(
      `[comfy] Split ${segments.length} segments into ${chunkPaths.length} chunks (per segment: ${chunkCountsPerSegment.join(", ")})`,
    );

    const chunkS3Keys: string[] = [];
    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkBuffer = fs.readFileSync(chunkPaths[i]);
      const chunkS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_chunk_${i}.mp4`;
      chunkS3Keys.push(chunkS3Key);
      await s3Service.uploadBuffer(chunkBuffer, chunkS3Key, "video/mp4");
    }

    console.log(`[comfy] Uploaded ${chunkS3Keys.length} chunks to S3`);

    const isSpliceMode =
      (segments.length >= 2 || spliceWithOriginal) && videoDuration > 0;

    const originalVideoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_original.mp4`;
    const originalBuffer = fs.readFileSync(videoPath);
    await s3Service.uploadBuffer(
      originalBuffer,
      originalVideoS3Key,
      "video/mp4",
    );
    console.log(`[comfy] Uploaded original video`);

    let spliceMetadata: {
      videoDuration: number;
      segments: SpliceSegment[];
    } | null = null;
    if (isSpliceMode) {
      const spliceSegments = calculateSpliceSegments(segments, videoDuration);
      let processedSegmentIndex = 0;
      for (const seg of spliceSegments) {
        if (seg.type === "processed") {
          seg.chunkCount = chunkCountsPerSegment[processedSegmentIndex];
          processedSegmentIndex++;
        }
      }
      spliceMetadata = { videoDuration, segments: spliceSegments };
    }

    for (let i = 0; i < imageSources.length; i++) {
      const jobId = jobIds[i];
      const imageSource = imageSources[i];

      try {
        let imageS3Key: string;

        if (imageSource.type === "s3key") {
          imageS3Key = imageSource.value;
          console.log(
            `[comfy] Using existing S3 key for job ${i}: ${imageS3Key}`,
          );
        } else {
          const imageBuffer = fs.readFileSync(imageSource.value);
          const imageExt = path.extname(imageSource.value) || ".jpg";
          imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${imageExt}`;
          await s3Service.uploadBuffer(imageBuffer, imageS3Key, "image/jpeg");
        }

        await db
          .update(comfyJobs)
          .set({
            status: "queued",
            imageFile: imageS3Key,
            videoFile: chunkS3Keys[0],
            originalVideoS3Key,
            spliceMode: isSpliceMode,
            spliceMetadata: spliceMetadata || undefined,
            progressMessage: "Waiting for worker",
          })
          .where(eq(comfyJobs.id, jobId));

        await sqsService.sendKlingFaceSwapJob({
          jobId,
          teamId,
          userId,
          imageS3Key,
          chunkS3Keys,
          originalVideoS3Key,
          segments,
          videoDuration,
          spliceMode: isSpliceMode,
          spliceMetadata: spliceMetadata || undefined,
          folderId,
          voiceId: voiceIds?.[i] || undefined,
          swapType,
        });
        console.log(`[comfy] Job ${jobId} sent to worker queue (${swapType})`);

        emitComfyJobUpdate(teamId, {
          id: jobId,
          status: "queued",
          progress: 0,
          progressMessage: "Waiting for worker",
          outputUrl: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
          finishedAt: null,
        });

        console.log(`[comfy] Job ${jobId} uploaded and queued successfully`);
      } catch (jobError) {
        console.error(`[comfy] Failed to process job ${jobId}:`, jobError);

        await db
          .update(comfyJobs)
          .set({
            status: "failed",
            errorMessage:
              jobError instanceof Error ? jobError.message : "Upload failed",
            finishedAt: new Date(),
          })
          .where(eq(comfyJobs.id, jobId));

        emitComfyJobUpdate(teamId, {
          id: jobId,
          status: "failed",
          progress: 0,
          progressMessage: null,
          outputUrl: null,
          errorMessage:
            jobError instanceof Error ? jobError.message : "Upload failed",
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });

        await teamService.decrementTeamUsage(teamId, UGC_CREDIT_COST);
        console.log(
          `[comfy] Refunded ${UGC_CREDIT_COST} credits for failed job ${jobId}`,
        );
      }
    }

    console.log(`[comfy] Background upload completed for team ${teamId}`);
  } catch (error) {
    console.error("[comfy] Background upload completely failed:", error);

    for (const jobId of jobIds) {
      try {
        await db
          .update(comfyJobs)
          .set({
            status: "failed",
            errorMessage: sanitizeErrorForFrontend(error, "Upload failed"),
            finishedAt: new Date(),
          })
          .where(eq(comfyJobs.id, jobId));

        emitComfyJobUpdate(teamId, {
          id: jobId,
          status: "failed",
          progress: 0,
          progressMessage: null,
          outputUrl: null,
          errorMessage: sanitizeErrorForFrontend(error, "Upload failed"),
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error(
          `[comfy] Failed to update job ${jobId} to failed:`,
          updateError,
        );
      }
    }

    const totalRefund = jobIds.length * UGC_CREDIT_COST;
    await teamService.decrementTeamUsage(teamId, totalRefund);
    console.log(
      `[comfy] Refunded ${totalRefund} credits for all failed jobs`,
    );
  } finally {
    const imageFilePaths = imageSources
      .filter((s) => s.type === "file")
      .map((s) => s.value);
    const filesToCleanup = [
      videoPath,
      ...imageFilePaths,
      ...segmentPaths,
      ...chunkPaths,
    ];
    for (const filePath of filesToCleanup) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignored
        }
      }
    }
    console.log(`[comfy] Cleaned up ${filesToCleanup.length} temp files`);
  }
}
