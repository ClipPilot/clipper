import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { db } from "../db";
import { comfyJobs, clips } from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { gpuSqsService, SwapType } from "../services/gpuSqs.service";
import { cutClip, getVideoDuration } from "../services/videoEditor.service";
import { createSceneAwareChunks } from "../services/sceneChunker.service";
import { detectFaceSegmentsWithPadding } from "../services/faceDetection.service";
import { emitComfyJobUpdate } from "../services/socket.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import "multer";
import { TEMP_DIR } from "../utils/tempCleanup";

const UGC_CREDIT_COST = 5;
const CHUNK_DURATION = 10;
const CHUNK_LEEWAY = 1; // Allow up to 1 extra second to avoid tiny leftover chunks

const idempotencyCache = new Map<string, { jobId: string; expiresAt: number }>();
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

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

interface SegmentInput {
  start: number;
  end: number;
}

interface SpliceSegment {
  start: number;
  end: number;
  type: "processed" | "original";
}

function calculateSpliceSegments(
  segments: SegmentInput[],
  videoDuration: number
): SpliceSegment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const result: SpliceSegment[] = [];

  if (sorted[0].start > 0.1) {
    result.push({ start: 0, end: sorted[0].start, type: "original" });
  }

  for (let i = 0; i < sorted.length; i++) {
    result.push({ start: sorted[i].start, end: sorted[i].end, type: "processed" });
    if (i < sorted.length - 1 && sorted[i].end < sorted[i + 1].start - 0.1) {
      result.push({ start: sorted[i].end, end: sorted[i + 1].start, type: "original" });
    }
  }

  if (sorted[sorted.length - 1].end < videoDuration - 0.1) {
    result.push({ start: sorted[sorted.length - 1].end, end: videoDuration, type: "original" });
  }

  return result;
}

export class ComfyController {
  async getUGCUploadUrls(req: AuthRequest, res: Response) {
    try {
      const { teamId, videoFileName, imageFileName } = req.body;

      if (!teamId || !videoFileName || !imageFileName) {
        return res.status(400).json({ error: "teamId, videoFileName, and imageFileName are required" });
      }

      const usage = await getTeamUsage(parseInt(teamId));
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }

      if (!canAccessUGCStudio(usage.plan)) {
        return res.status(403).json({
          error: "UGC Studio is only available on Studio, Scale, and Enterprise plans.",
          code: "PLAN_REQUIRED",
        });
      }

      if (usage.totalRemaining < UGC_CREDIT_COST) {
        return res.status(403).json({
          error: `Insufficient credits. UGC generation requires ${UGC_CREDIT_COST} credits.`,
          code: "INSUFFICIENT_CREDITS",
        });
      }

      const urls = await s3Service.getUGCUploadUrls(
        parseInt(teamId),
        videoFileName,
        imageFileName
      );

      return res.status(200).json(urls);
    } catch (error) {
      console.error("Get UGC upload URLs error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get upload URLs",
      });
    }
  }

  async createUGCFaceSwapJob(req: AuthRequest, res: Response) {
    const MAX_VIDEO_DURATION = 50;
    let tempVideoPath: string | null = null;
    const segmentPaths: string[] = [];
    const chunkPaths: string[] = [];

    try {
      const {
        teamId,
        startTime,
        endTime,
        segments: segmentsRaw,
        videoDuration: videoDurationRaw,
        swapType: swapTypeRaw,
        videoS3Key: videoS3KeyInput,
        imageS3Key: imageS3KeyInput,
      } = req.body;
      const swapType: SwapType = swapTypeRaw === "full" ? "full" : "face";
      const videoDuration = parseFloat(videoDurationRaw) || 0;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      let imageS3Key: string;

      if (videoS3KeyInput && imageS3KeyInput) {
        console.log(`[comfy] Using S3 keys: video=${videoS3KeyInput}, image=${imageS3KeyInput}`);
        imageS3Key = imageS3KeyInput;
        tempVideoPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.mp4`);
        await s3Service.downloadFile(videoS3KeyInput, tempVideoPath);
        console.log(`[comfy] Downloaded video from S3 to ${tempVideoPath}`);
      } else {
        const files = req.files as {
          image?: Express.Multer.File[];
          video?: Express.Multer.File[];
        };

        const image = files?.image?.[0];
        const video = files?.video?.[0];

        if (!image || !video) {
          return res.status(400).json({
            error: "Both image and video files are required (or provide S3 keys)",
          });
        }

        if (!image.mimetype.startsWith("image/")) {
          return res.status(400).json({ error: "Invalid image file type" });
        }

        if (!video.mimetype.startsWith("video/")) {
          return res.status(400).json({ error: "Invalid video file type" });
        }

        tempVideoPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.mp4`);
        fs.writeFileSync(tempVideoPath, video.buffer);

        const imageExt = path.extname(image.originalname) || ".jpg";
        imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${imageExt}`;
        await s3Service.uploadBuffer(image.buffer, imageS3Key, image.mimetype);
      }

      let segments: SegmentInput[];
      if (segmentsRaw) {
        segments = typeof segmentsRaw === "string" ? JSON.parse(segmentsRaw) : segmentsRaw;
      } else {
        segments = [{ start: parseFloat(startTime) || 0, end: parseFloat(endTime) || 0 }];
      }

      if (segments.length === 0 || segments.length > 5) {
        return res.status(400).json({ error: "Must provide 1-5 segments" });
      }

      let totalDuration = 0;
      for (const seg of segments) {
        if (seg.start >= seg.end) {
          return res.status(400).json({ error: "Each segment must have start < end" });
        }
        totalDuration += seg.end - seg.start;
      }

      if (totalDuration <= 0 || totalDuration > MAX_VIDEO_DURATION + 0.1) {
        return res.status(400).json({
          error: `Combined segment duration must be between 0 and ${MAX_VIDEO_DURATION} seconds`,
        });
      }

      const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
      for (let i = 0; i < sortedSegments.length - 1; i++) {
        if (sortedSegments[i].end > sortedSegments[i + 1].start) {
          return res.status(400).json({ error: "Segments cannot overlap" });
        }
      }

      const usage = await getTeamUsage(parseInt(teamId));
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }

      if (!canAccessUGCStudio(usage.plan)) {
        return res.status(403).json({
          error: "UGC Studio is only available on Studio, Scale, and Enterprise plans. Please upgrade to access this feature.",
          code: "PLAN_REQUIRED",
          requiredPlan: "studio",
          currentPlan: usage.plan,
        });
      }

      if (usage.totalRemaining < UGC_CREDIT_COST) {
        return res.status(403).json({
          error: `Insufficient credits. UGC generation requires ${UGC_CREDIT_COST} credits, but you have ${usage.totalRemaining} remaining.`,
          code: "INSUFFICIENT_CREDITS",
          required: UGC_CREDIT_COST,
          available: usage.totalRemaining,
        });
      }

      const idempotencyKey = req.body.idempotencyKey;
      if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && Date.now() < cached.expiresAt) {
          console.log(`[comfy] Returning cached job for idempotency key: ${idempotencyKey} -> ${cached.jobId}`);
          return res.status(202).json({
            message: "UGC face swap job already queued (retry detected)",
            jobId: cached.jobId,
          });
        }
      }

      await teamService.incrementTeamUsage(parseInt(teamId), UGC_CREDIT_COST);
      console.log(`[comfy] Charged ${UGC_CREDIT_COST} credits upfront to team ${teamId}`);

      // Scene-aware chunking: detect scene boundaries and combine to ~10s chunks
      // Falls back to blind 10s chunking if scene detection fails
      for (let i = 0; i < segments.length; i++) {
        const segPath = path.join(TEMP_DIR, `${crypto.randomUUID()}_segment_${i}.mp4`);
        await cutClip(tempVideoPath, segPath, segments[i].start, segments[i].end);
        segmentPaths.push(segPath);

        const segmentChunks = await createSceneAwareChunks(segPath, TEMP_DIR, {
          targetDuration: CHUNK_DURATION,
          leeway: CHUNK_LEEWAY,
        });

        chunkPaths.push(...segmentChunks);
      }

      console.log(`[comfy] Split ${segments.length} segments into ${chunkPaths.length} chunks`);

      const spliceWithOriginal = req.body.spliceWithOriginal === "true" || req.body.spliceWithOriginal === true;
      const isSpliceMode = (segments.length >= 2 || spliceWithOriginal) && videoDuration > 0;
      const spliceMetadata = isSpliceMode
        ? { videoDuration, segments: calculateSpliceSegments(segments, videoDuration) }
        : null;

      const uploads: Promise<string>[] = [];
      const chunkS3Keys: string[] = [];
      for (let i = 0; i < chunkPaths.length; i++) {
        const chunkBuffer = fs.readFileSync(chunkPaths[i]);
        const chunkS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_chunk_${i}.mp4`;
        chunkS3Keys.push(chunkS3Key);
        uploads.push(s3Service.uploadBuffer(chunkBuffer, chunkS3Key, "video/mp4"));
      }

      let originalVideoS3Key: string | undefined;
      if (isSpliceMode) {
        originalVideoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_original.mp4`;
        const originalBuffer = fs.readFileSync(tempVideoPath);
        uploads.push(s3Service.uploadBuffer(originalBuffer, originalVideoS3Key, "video/mp4"));
      }

      await Promise.all(uploads);

      const jobId = crypto.randomUUID();
      const now = new Date();

      await db
        .insert(comfyJobs)
        .values({
          id: jobId,
          teamId: parseInt(teamId),
          status: "queued",
          imageFile: imageS3Key,
          videoFile: chunkS3Keys[0],
          jobType: "ugc-face-swap-parent",
          priority: Math.floor(Date.now() / 1000),
          originalVideoS3Key,
          spliceMode: isSpliceMode,
          spliceMetadata: spliceMetadata || undefined,
          progress: 0,
          progressMessage: "Waiting for GPU worker",
          createdAt: now,
        });

      console.log(`[comfy] Created job record in DB: ${jobId}`);

      await gpuSqsService.sendFaceSwapJob({
        jobId,
        teamId: parseInt(teamId),
        userId: req.user!.dbUserId,
        imageS3Key,
        chunkS3Keys,
        originalVideoS3Key,
        segments: sortedSegments,
        videoDuration,
        spliceMode: isSpliceMode,
        spliceMetadata: spliceMetadata || undefined,
        swapType,
      });

      console.log(`[comfy] Sent job to GPU SQS queue: ${jobId}`);

      emitComfyJobUpdate(parseInt(teamId), {
        id: jobId,
        status: "queued",
        progress: 0,
        progressMessage: "Waiting for GPU worker",
        outputUrl: null,
        errorMessage: null,
        createdAt: now.toISOString(),
        finishedAt: null,
      });

      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          jobId,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }

      return res.status(202).json({
        message: "UGC face swap job queued",
        jobId,
        duration: Math.round(totalDuration),
      });
    } catch (error) {
      console.error("Create UGC face swap job error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to queue job",
      });
    } finally {
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      for (const p of [...segmentPaths, ...chunkPaths]) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
  }

  async getJobStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

      const [job] = await db
        .select({
          id: comfyJobs.id,
          status: comfyJobs.status,
          progress: comfyJobs.progress,
          progressMessage: comfyJobs.progressMessage,
          outputFile: comfyJobs.outputFile,
          errorMessage: comfyJobs.errorMessage,
          createdAt: comfyJobs.createdAt,
          finishedAt: comfyJobs.finishedAt,
          spliceMetadata: comfyJobs.spliceMetadata,
          clipId: clips.id,
          title: clips.title,
        })
        .from(comfyJobs)
        .leftJoin(
          clips,
          sql`${clips.clip_metadata}->>'comfyJobId' = ${comfyJobs.id}::text`
        )
        .where(eq(comfyJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      let outputUrl: string | null = null;
      if (job.outputFile) {
        const s3Key = job.outputFile.startsWith("s3://")
          ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
          : job.outputFile;
        outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
      }

      let spliceSegments: Array<{ url: string; type: string; start: number; end: number }> | null = null;
      const metadata = job.spliceMetadata as { processedSegments?: Array<{ s3Key: string; type: string; start: number; end: number }> } | null;
      if (metadata?.processedSegments) {
        spliceSegments = await Promise.all(
          metadata.processedSegments.map(async (seg) => ({
            url: await s3Service.getPresignedUrl(seg.s3Key, 3600),
            type: seg.type,
            start: seg.start,
            end: seg.end,
          }))
        );
      }

      return res.status(200).json({
        job: {
          ...job,
          outputUrl,
          spliceSegments,
        },
      });
    } catch (error) {
      console.error("Get job error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get job",
      });
    }
  }

  async getTeamJobs(req: Request, res: Response) {
    try {
      const { teamId } = req.params;

      if (!teamId) {
        return res.status(400).json({ error: "Team ID required" });
      }

      const jobs = await db
        .select({
          id: comfyJobs.id,
          status: comfyJobs.status,
          progress: comfyJobs.progress,
          progressMessage: comfyJobs.progressMessage,
          outputFile: comfyJobs.outputFile,
          errorMessage: comfyJobs.errorMessage,
          createdAt: comfyJobs.createdAt,
          finishedAt: comfyJobs.finishedAt,
          spliceMetadata: comfyJobs.spliceMetadata,
          clipId: clips.id,
          title: clips.title,
        })
        .from(comfyJobs)
        .leftJoin(
          clips,
          sql`${clips.clip_metadata}->>'comfyJobId' = ${comfyJobs.id}::text`
        )
        .where(eq(comfyJobs.teamId, parseInt(teamId)))
        .orderBy(desc(comfyJobs.createdAt))
        .limit(20);

      const jobsWithUrls = await Promise.all(
        jobs.map(async (job) => {
          let outputUrl: string | null = null;
          if (job.outputFile) {
            const s3Key = job.outputFile.startsWith("s3://")
              ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
              : job.outputFile;
            outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
          }

          let spliceSegments: Array<{ url: string; type: string; start: number; end: number }> | null = null;
          const metadata = job.spliceMetadata as { processedSegments?: Array<{ s3Key: string; type: string; start: number; end: number }> } | null;
          if (metadata?.processedSegments) {
            spliceSegments = await Promise.all(
              metadata.processedSegments.map(async (seg) => ({
                url: await s3Service.getPresignedUrl(seg.s3Key, 3600),
                type: seg.type,
                start: seg.start,
                end: seg.end,
              }))
            );
          }

          return { ...job, outputUrl, spliceSegments };
        })
      );

      return res.status(200).json({ jobs: jobsWithUrls });
    } catch (error) {
      console.error("Get team jobs error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get jobs",
      });
    }
  }

  async deleteJob(req: Request, res: Response) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

      // First check if job exists
      const [job] = await db
        .select({
          id: comfyJobs.id,
          teamId: comfyJobs.teamId,
          outputFile: comfyJobs.outputFile,
        })
        .from(comfyJobs)
        .where(eq(comfyJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Delete the output file from S3 if it exists
      if (job.outputFile) {
        try {
          const s3Key = job.outputFile.startsWith("s3://")
            ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
            : job.outputFile;
          await s3Service.deleteObject(s3Key);
          console.log(`[comfy] Deleted S3 object: ${s3Key}`);
        } catch (s3Error) {
          console.warn(`[comfy] Failed to delete S3 object: ${s3Error}`);
          // Continue with DB deletion even if S3 delete fails
        }
      }

      // Delete the job from database
      await db.delete(comfyJobs).where(eq(comfyJobs.id, jobId));

      // Emit update to notify frontend
      emitComfyJobUpdate(job.teamId, {
        id: jobId,
        status: "deleted",
        progress: 0,
        progressMessage: null,
        outputUrl: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        finishedAt: null,
      });

      console.log(`[comfy] Deleted job ${jobId}`);
      return res.status(200).json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Delete job error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete job",
      });
    }
  }

  async updateJob(req: Request, res: Response) {
    try {
      const { jobId } = req.params;
      const { title } = req.body;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

      // Check if job exists
      const [job] = await db
        .select({ id: comfyJobs.id, teamId: comfyJobs.teamId })
        .from(comfyJobs)
        .where(eq(comfyJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Find the associated clip by comfyJobId in clip_metadata
      const [clip] = await db
        .select({ id: clips.id })
        .from(clips)
        .where(sql`${clips.clip_metadata}->>'comfyJobId' = ${jobId}`);

      if (!clip) {
        return res.status(404).json({ error: "Associated clip not found. The job may not be completed yet." });
      }

      // Update the clip's title
      await db
        .update(clips)
        .set({ title: title ?? null })
        .where(eq(clips.id, clip.id));

      console.log(`[comfy] Updated clip ${clip.id} title to: ${title} (for job ${jobId})`);
      return res.status(200).json({ message: "Title updated successfully", title, clipId: clip.id });
    } catch (error) {
      console.error("Update job error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update job",
      });
    }
  }

  async createUGCFaceSwapWithUpload(req: AuthRequest, res: Response) {
    const MAX_VIDEO_DURATION = 50;

    try {
      const {
        teamId,
        segments: segmentsRaw,
        videoDuration: videoDurationRaw,
        swapType: swapTypeRaw,
        idempotencyKey,
        spliceWithOriginal,
        autoDetect: autoDetectRaw,
      } = req.body;

      const autoDetect = autoDetectRaw === "true" || autoDetectRaw === true;

      const files = req.files as {
        video?: Express.Multer.File[];
        images?: Express.Multer.File[];
      };

      if (!files?.video?.[0]) {
        return res.status(400).json({ error: "Video file is required" });
      }

      if (!files?.images?.length) {
        return res.status(400).json({ error: "At least one image is required" });
      }

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      let segments: SegmentInput[] = [];
      let sortedSegments: SegmentInput[] = [];

      if (!autoDetect) {
        if (segmentsRaw) {
          segments = typeof segmentsRaw === "string" ? JSON.parse(segmentsRaw) : segmentsRaw;
        } else {
          return res.status(400).json({ error: "segments are required (or set autoDetect=true)" });
        }

        if (segments.length === 0 || segments.length > 5) {
          return res.status(400).json({ error: "Must provide 1-5 segments" });
        }

        let totalDuration = 0;
        for (const seg of segments) {
          if (seg.start >= seg.end) {
            return res.status(400).json({ error: "Each segment must have start < end" });
          }
          totalDuration += seg.end - seg.start;
        }

        if (totalDuration <= 0 || totalDuration > MAX_VIDEO_DURATION + 0.1) {
          return res.status(400).json({
            error: `Combined segment duration must be between 0 and ${MAX_VIDEO_DURATION} seconds`,
          });
        }

        sortedSegments = [...segments].sort((a, b) => a.start - b.start);
        for (let i = 0; i < sortedSegments.length - 1; i++) {
          if (sortedSegments[i].end > sortedSegments[i + 1].start) {
            return res.status(400).json({ error: "Segments cannot overlap" });
          }
        }
      }

      const usage = await getTeamUsage(parseInt(teamId));
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }

      if (!canAccessUGCStudio(usage.plan)) {
        return res.status(403).json({
          error: "UGC Studio is only available on Studio, Scale, and Enterprise plans.",
          code: "PLAN_REQUIRED",
        });
      }

      const totalCreditCost = files.images.length * UGC_CREDIT_COST;
      if (usage.totalRemaining < totalCreditCost) {
        return res.status(403).json({
          error: `Insufficient credits. ${files.images.length} face swaps require ${totalCreditCost} credits, but you have ${usage.totalRemaining} remaining.`,
          code: "INSUFFICIENT_CREDITS",
        });
      }

      if (idempotencyKey) {
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && Date.now() < cached.expiresAt) {
          console.log(`[comfy] Returning cached job for idempotency key: ${idempotencyKey}`);
          return res.status(202).json({
            message: "Jobs already queued (retry detected)",
            jobIds: [cached.jobId],
          });
        }
      }

      await teamService.incrementTeamUsage(parseInt(teamId), totalCreditCost);
      console.log(`[comfy] Charged ${totalCreditCost} credits upfront to team ${teamId}`);

      const jobIds: string[] = [];
      const now = new Date();

      for (let i = 0; i < files.images.length; i++) {
        const jobId = crypto.randomUUID();
        jobIds.push(jobId);

        await db.insert(comfyJobs).values({
          id: jobId,
          teamId: parseInt(teamId),
          status: "pending_upload",
          imageFile: `pending:${i}`,
          videoFile: "pending",
          jobType: "ugc-face-swap-parent",
          priority: Math.floor(Date.now() / 1000),
          progress: 0,
          progressMessage: "Uploading files to storage...",
          createdAt: now,
        });

        emitComfyJobUpdate(parseInt(teamId), {
          id: jobId,
          status: "pending_upload",
          progress: 0,
          progressMessage: "Uploading files to storage...",
          outputUrl: null,
          errorMessage: null,
          createdAt: now.toISOString(),
          finishedAt: null,
        });
      }

      console.log(`[comfy] Created ${jobIds.length} jobs with pending_upload status`);

      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          jobId: jobIds[0],
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }

      res.status(202).json({
        message: "Jobs created, upload in progress",
        jobIds,
      });

      const videoDuration = parseFloat(videoDurationRaw) || 0;
      const swapType: SwapType = swapTypeRaw === "full" ? "full" : "face";

      this.processBackgroundUpload({
        jobIds,
        teamId: parseInt(teamId),
        userId: req.user!.dbUserId,
        videoPath: files.video[0].path,
        imagePaths: files.images.map((f) => f.path),
        segments: sortedSegments,
        videoDuration,
        swapType,
        spliceWithOriginal: spliceWithOriginal === "true" || spliceWithOriginal === true,
        autoDetect,
      }).catch((err) => {
        console.error("[comfy] Background upload failed:", err);
        Sentry.captureException(err);
      });
    } catch (error) {
      console.error("Create UGC face swap upload error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create jobs",
      });
    }
  }

  private async processBackgroundUpload(params: {
    jobIds: string[];
    teamId: number;
    userId: number;
    videoPath: string;
    imagePaths: string[];
    segments: SegmentInput[];
    videoDuration: number;
    swapType: SwapType;
    spliceWithOriginal: boolean;
    autoDetect: boolean;
  }) {
    const {
      jobIds,
      teamId,
      userId,
      videoPath,
      imagePaths,
      swapType,
      spliceWithOriginal,
      autoDetect,
    } = params;

    let { segments, videoDuration } = params;

    const segmentPaths: string[] = [];
    const chunkPaths: string[] = [];
    const MAX_VIDEO_DURATION = 50;

    try {
      console.log(`[comfy] Starting background upload for ${jobIds.length} jobs (autoDetect=${autoDetect})`);

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

        const detectedSegments = await detectFaceSegmentsWithPadding(videoPath, videoDuration);
        console.log(`[comfy] Detected ${detectedSegments.length} face segments`);

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
              selectedSegments.push({ start: seg.start, end: seg.start + availableDuration });
            }
            break;
          }
        }

        if (selectedSegments.length === 0) {
          throw new Error("No usable face segments found");
        }

        segments = selectedSegments.sort((a, b) => a.start - b.start);
        console.log(`[comfy] Using ${segments.length} segments (${totalDur.toFixed(1)}s total)`);

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

      for (let i = 0; i < segments.length; i++) {
        const segPath = path.join(TEMP_DIR, `${crypto.randomUUID()}_segment_${i}.mp4`);
        await cutClip(videoPath, segPath, segments[i].start, segments[i].end);
        segmentPaths.push(segPath);

        const segmentChunks = await createSceneAwareChunks(segPath, TEMP_DIR, {
          targetDuration: CHUNK_DURATION,
          leeway: CHUNK_LEEWAY,
        });

        chunkPaths.push(...segmentChunks);
      }

      console.log(`[comfy] Split ${segments.length} segments into ${chunkPaths.length} chunks`);

      const chunkS3Keys: string[] = [];
      for (let i = 0; i < chunkPaths.length; i++) {
        const chunkBuffer = fs.readFileSync(chunkPaths[i]);
        const chunkS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_chunk_${i}.mp4`;
        chunkS3Keys.push(chunkS3Key);
        await s3Service.uploadBuffer(chunkBuffer, chunkS3Key, "video/mp4");
      }

      console.log(`[comfy] Uploaded ${chunkS3Keys.length} chunks to S3`);

      const isSpliceMode = (segments.length >= 2 || spliceWithOriginal) && videoDuration > 0;
      let originalVideoS3Key: string | undefined;

      if (isSpliceMode) {
        originalVideoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_original.mp4`;
        const originalBuffer = fs.readFileSync(videoPath);
        await s3Service.uploadBuffer(originalBuffer, originalVideoS3Key, "video/mp4");
        console.log(`[comfy] Uploaded original video for splice mode`);
      }

      const spliceMetadata = isSpliceMode
        ? { videoDuration, segments: calculateSpliceSegments(segments, videoDuration) }
        : null;

      for (let i = 0; i < imagePaths.length; i++) {
        const jobId = jobIds[i];
        const imagePath = imagePaths[i];

        try {
          const imageBuffer = fs.readFileSync(imagePath);
          const imageExt = path.extname(imagePath) || ".jpg";
          const imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${imageExt}`;
          await s3Service.uploadBuffer(imageBuffer, imageS3Key, "image/jpeg");

          await db
            .update(comfyJobs)
            .set({
              status: "queued",
              imageFile: imageS3Key,
              videoFile: chunkS3Keys[0],
              originalVideoS3Key,
              spliceMode: isSpliceMode,
              spliceMetadata: spliceMetadata || undefined,
              progressMessage: "Waiting for GPU worker",
            })
            .where(eq(comfyJobs.id, jobId));

          await gpuSqsService.sendFaceSwapJob({
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
            swapType,
          });

          emitComfyJobUpdate(teamId, {
            id: jobId,
            status: "queued",
            progress: 0,
            progressMessage: "Waiting for GPU worker",
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
              errorMessage: jobError instanceof Error ? jobError.message : "Upload failed",
              finishedAt: new Date(),
            })
            .where(eq(comfyJobs.id, jobId));

          emitComfyJobUpdate(teamId, {
            id: jobId,
            status: "failed",
            progress: 0,
            progressMessage: null,
            outputUrl: null,
            errorMessage: jobError instanceof Error ? jobError.message : "Upload failed",
            createdAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          });

          await teamService.decrementTeamUsage(teamId, UGC_CREDIT_COST);
          console.log(`[comfy] Refunded ${UGC_CREDIT_COST} credits for failed job ${jobId}`);
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
              errorMessage: error instanceof Error ? error.message : "Upload failed",
              finishedAt: new Date(),
            })
            .where(eq(comfyJobs.id, jobId));

          emitComfyJobUpdate(teamId, {
            id: jobId,
            status: "failed",
            progress: 0,
            progressMessage: null,
            outputUrl: null,
            errorMessage: error instanceof Error ? error.message : "Upload failed",
            createdAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
          });
        } catch (updateError) {
          console.error(`[comfy] Failed to update job ${jobId} to failed:`, updateError);
        }
      }

      // Refund all credits
      const totalRefund = jobIds.length * UGC_CREDIT_COST;
      await teamService.decrementTeamUsage(teamId, totalRefund);
      console.log(`[comfy] Refunded ${totalRefund} credits for all failed jobs`);
    } finally {
      // Cleanup temp files
      const filesToCleanup = [videoPath, ...imagePaths, ...segmentPaths, ...chunkPaths];
      for (const filePath of filesToCleanup) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
      console.log(`[comfy] Cleaned up ${filesToCleanup.length} temp files`);
    }
  }
}

export const comfyController = new ComfyController();
