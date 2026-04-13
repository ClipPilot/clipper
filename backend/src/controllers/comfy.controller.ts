import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import type { ErrorResponse } from "../types/api.types";
import { db } from "../db";
import { comfyJobs, clips, savedFaces } from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import {
  cutClip,
} from "../services/clips/videoEditor.service";
import { createSceneAwareChunks } from "../services/ai-ugc/sceneChunker.service";
import { emitComfyJobUpdate } from "../services/socket.service";
import { falImageService } from "../services/ai-ugc/falImage.service";
import { POSE_GENERATION_PROMPT } from "../config/ugcPrompts";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import {
  checkIdempotency,
  setIdempotency,
  calculateSpliceSegments,
  processBackgroundUpload,
  SegmentInput,
  SpliceSegment,
} from "../services/klingJob.service";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import "multer";
import { TEMP_DIR } from "../utils/tempCleanup";
import { handleControllerError, verifyTeamAccessOrFail } from "../utils/controllerHelpers";
import { AuthRequest } from "../middleware/auth.middleware";
import { UGC_CREDIT_COST } from "../constants/credits";
import { INSUFFICIENT_CREDITS } from "../constants/errorCodes";

const KLING_CHUNK_DURATION = 25;
const KLING_CHUNK_LEEWAY = 5;

export class ComfyController {
  async getUGCUploadUrls(req: AuthRequest, res: Response) {
    try {
      const { teamId, videoFileName, imageFileName } = req.body;

      if (!teamId || !videoFileName || !imageFileName) {
        return res.status(400).json({
          error: "teamId, videoFileName, and imageFileName are required",
        });
      }

      const usage = await getTeamUsage(parseInt(teamId));
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }

      if (!canAccessUGCStudio(usage.plan)) {
        return res.status(403).json({
          error:
            "UGC Studio is only available on Studio, Scale, and Enterprise plans.",
          code: "PLAN_REQUIRED",
        });
      }

      if (usage.totalRemaining < UGC_CREDIT_COST) {
        return res.status(403).json({
          error: `Insufficient credits. UGC generation requires ${UGC_CREDIT_COST} credits.`,
          code: INSUFFICIENT_CREDITS,
        });
      }

      const urls = await s3Service.getUGCUploadUrls(
        parseInt(teamId),
        videoFileName,
        imageFileName,
      );

      return res.status(200).json(urls);
    } catch (error) {
      return handleControllerError(res, "Get upload URLs", error, "Failed to get upload URLs");
    }
  }

  async createUGCFaceSwapJob(req: AuthRequest, res: Response) {
    const MAX_VIDEO_DURATION = 300;
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
        videoS3Key: videoS3KeyInput,
        imageS3Key: imageS3KeyInput,
      } = req.body;
      const videoDuration = parseFloat(videoDurationRaw) || 0;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      let imageS3Key: string;

      if (videoS3KeyInput && imageS3KeyInput) {
        console.log(
          `[comfy] Using S3 keys: video=${videoS3KeyInput}, image=${imageS3KeyInput}`,
        );
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
            error:
              "Both image and video files are required (or provide S3 keys)",
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
        segments =
          typeof segmentsRaw === "string"
            ? JSON.parse(segmentsRaw)
            : segmentsRaw;
      } else {
        segments = [
          { start: parseFloat(startTime) || 0, end: parseFloat(endTime) || 0 },
        ];
      }

      if (segments.length === 0 || segments.length > 5) {
        return res.status(400).json({ error: "Must provide 1-5 segments" });
      }

      let totalDuration = 0;
      for (const seg of segments) {
        if (seg.start >= seg.end) {
          return res
            .status(400)
            .json({ error: "Each segment must have start < end" });
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
          error:
            "UGC Studio is only available on Studio, Scale, and Enterprise plans. Please upgrade to access this feature.",
          code: "PLAN_REQUIRED",
          requiredPlan: "studio",
          currentPlan: usage.plan,
        });
      }

      if (usage.totalRemaining < UGC_CREDIT_COST) {
        return res.status(403).json({
          error: `Insufficient credits. UGC generation requires ${UGC_CREDIT_COST} credits, but you have ${usage.totalRemaining} remaining.`,
          code: INSUFFICIENT_CREDITS,
          required: UGC_CREDIT_COST,
          available: usage.totalRemaining,
        });
      }

      const idempotencyKey = req.body.idempotencyKey;
      if (idempotencyKey) {
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
          console.log(
            `[comfy] Returning cached job for idempotency key: ${idempotencyKey} -> ${cached.jobId}`,
          );
          return res.status(202).json({
            message: "UGC face swap job already queued (retry detected)",
            jobId: cached.jobId,
          });
        }
      }

      await teamService.incrementTeamUsage(parseInt(teamId), UGC_CREDIT_COST);
      console.log(
        `[comfy] Charged ${UGC_CREDIT_COST} credits upfront to team ${teamId}`,
      );

      const chunkDuration = KLING_CHUNK_DURATION;
      const chunkLeeway = KLING_CHUNK_LEEWAY;

      console.log(`[comfy] Routing to Kling (chunk: ${chunkDuration}s)`);

      const chunkCountsPerSegment: number[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segPath = path.join(
          TEMP_DIR,
          `${crypto.randomUUID()}_segment_${i}.mp4`,
        );
        await cutClip(
          tempVideoPath,
          segPath,
          segments[i].start,
          segments[i].end,
        );
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

      const spliceWithOriginal =
        req.body.spliceWithOriginal === "true" ||
        req.body.spliceWithOriginal === true;
      const isSpliceMode =
        (segments.length >= 2 || spliceWithOriginal) && videoDuration > 0;

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

      const uploads: Promise<string>[] = [];
      const chunkS3Keys: string[] = [];
      for (let i = 0; i < chunkPaths.length; i++) {
        const chunkBuffer = fs.readFileSync(chunkPaths[i]);
        const chunkS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_chunk_${i}.mp4`;
        chunkS3Keys.push(chunkS3Key);
        uploads.push(
          s3Service.uploadBuffer(chunkBuffer, chunkS3Key, "video/mp4"),
        );
      }

      let originalVideoS3Key: string | undefined;
      if (isSpliceMode) {
        originalVideoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_original.mp4`;
        const originalBuffer = fs.readFileSync(tempVideoPath);
        uploads.push(
          s3Service.uploadBuffer(
            originalBuffer,
            originalVideoS3Key,
            "video/mp4",
          ),
        );
      }

      await Promise.all(uploads);

      const jobId = crypto.randomUUID();
      const now = new Date();

      await db.insert(comfyJobs).values({
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
        progressMessage: "Waiting for worker",
        createdAt: now,
      });

      console.log(`[comfy] Created job record in DB: ${jobId}`);

      await sqsService.sendKlingFaceSwapJob({
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
      });
      console.log(`[comfy] Sent job to Kling worker queue: ${jobId}`);

      emitComfyJobUpdate(parseInt(teamId), {
        id: jobId,
        status: "queued",
        progress: 0,
        progressMessage: "Waiting for worker",
        outputUrl: null,
        errorMessage: null,
        createdAt: now.toISOString(),
        finishedAt: null,
      });

      if (idempotencyKey) {
        setIdempotency(idempotencyKey, jobId);
      }

      return res.status(202).json({
        message: "UGC face swap job queued",
        jobId,
        duration: Math.round(totalDuration),
      });
    } catch (error) {
      return handleControllerError(res, "Create face swap job", error, "Failed to queue job");
    } finally {
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      for (const p of [...segmentPaths, ...chunkPaths]) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
  }

  async getJobStatus(req: AuthRequest, res: Response<{ job: Record<string, any> } | ErrorResponse>) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

      const [job] = await db
        .select({
          id: comfyJobs.id,
          teamId: comfyJobs.teamId,
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
          sql`${clips.clip_metadata}->>'comfyJobId' = ${comfyJobs.id}::text`,
        )
        .where(eq(comfyJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (!(await verifyTeamAccessOrFail(req, job.teamId, res))) return;

      let outputUrl: string | null = null;
      if (job.outputFile) {
        const s3Key = job.outputFile.startsWith("s3://")
          ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
          : job.outputFile;
        outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
      }

      let spliceSegments: Array<{
        url: string;
        type: string;
        start: number;
        end: number;
      }> | null = null;
      const metadata = job.spliceMetadata as {
        processedSegments?: Array<{
          s3Key: string;
          type: string;
          start: number;
          end: number;
        }>;
      } | null;
      if (metadata?.processedSegments) {
        spliceSegments = await Promise.all(
          metadata.processedSegments.map(async (seg) => ({
            url: await s3Service.getPresignedUrl(seg.s3Key, 3600),
            type: seg.type,
            start: seg.start,
            end: seg.end,
          })),
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
      return handleControllerError(res, "Get job", error, "Failed to get job");
    }
  }

  async getTeamJobs(req: AuthRequest, res: Response<{ jobs: Record<string, any>[]; total: number; limit: number; offset: number } | ErrorResponse>) {
    try {
      const { teamId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 6, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      if (!teamId) {
        return res.status(400).json({ error: "Team ID required" });
      }

      if (!(await verifyTeamAccessOrFail(req, parseInt(teamId), res))) return;

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(comfyJobs)
        .where(eq(comfyJobs.teamId, parseInt(teamId)));
      const total = Number(countResult?.count || 0);

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
          sql`${clips.clip_metadata}->>'comfyJobId' = ${comfyJobs.id}::text`,
        )
        .where(eq(comfyJobs.teamId, parseInt(teamId)))
        .orderBy(desc(comfyJobs.createdAt))
        .limit(limit)
        .offset(offset);

      const jobsWithUrls = await Promise.all(
        jobs.map(async (job) => {
          let outputUrl: string | null = null;
          if (job.outputFile) {
            const s3Key = job.outputFile.startsWith("s3://")
              ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
              : job.outputFile;
            outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
          }

          let spliceSegments: Array<{
            url: string;
            type: string;
            start: number;
            end: number;
          }> | null = null;
          const metadata = job.spliceMetadata as {
            processedSegments?: Array<{
              s3Key: string;
              type: string;
              start: number;
              end: number;
            }>;
          } | null;
          if (metadata?.processedSegments) {
            spliceSegments = await Promise.all(
              metadata.processedSegments.map(async (seg) => ({
                url: await s3Service.getPresignedUrl(seg.s3Key, 3600),
                type: seg.type,
                start: seg.start,
                end: seg.end,
              })),
            );
          }

          return { ...job, outputUrl, spliceSegments };
        }),
      );

      return res.status(200).json({ jobs: jobsWithUrls, total, limit, offset });
    } catch (error) {
      return handleControllerError(res, "Get team jobs error", error, "Failed to get jobs");
    }
  }

  async deleteJob(req: AuthRequest, res: Response) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

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

      if (!(await verifyTeamAccessOrFail(req, job.teamId, res))) return;

      if (job.outputFile) {
        try {
          const s3Key = job.outputFile.startsWith("s3://")
            ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
            : job.outputFile;
          await s3Service.deleteObject(s3Key);
          console.log(`[comfy] Deleted S3 object: ${s3Key}`);
        } catch (s3Error) {
          console.warn(`[comfy] Failed to delete S3 object: ${s3Error}`);
        }
      }

      await db.delete(comfyJobs).where(eq(comfyJobs.id, jobId));

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
      return handleControllerError(res, "Delete job error", error, "Failed to delete job");
    }
  }

  async updateJob(req: Request, res: Response) {
    try {
      const { jobId } = req.params;
      const { title } = req.body;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

      const [job] = await db
        .select({ id: comfyJobs.id, teamId: comfyJobs.teamId })
        .from(comfyJobs)
        .where(eq(comfyJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const [clip] = await db
        .select({ id: clips.id })
        .from(clips)
        .where(sql`${clips.clip_metadata}->>'comfyJobId' = ${jobId}`);

      if (!clip) {
        return res.status(404).json({
          error: "Associated clip not found. The job may not be completed yet.",
        });
      }

      await db
        .update(clips)
        .set({ title: title ?? null })
        .where(eq(clips.id, clip.id));

      console.log(
        `[comfy] Updated clip ${clip.id} title to: ${title} (for job ${jobId})`,
      );
      return res.status(200).json({
        message: "Title updated successfully",
        title,
        clipId: clip.id,
      });
    } catch (error) {
      return handleControllerError(res, "Update job error", error, "Failed to update job");
    }
  }

  async createUGCFaceSwapWithUpload(req: AuthRequest, res: Response) {
    const MAX_VIDEO_DURATION = 300;

    try {
      const {
        teamId,
        segments: segmentsRaw,
        videoDuration: videoDurationRaw,
        idempotencyKey,
        spliceWithOriginal,
        autoDetect: autoDetectRaw,
        imageKeys: imageKeysRaw,
        folderId: folderIdRaw,
        voiceId,
        voiceIds: voiceIdsRaw,
        swapType: swapTypeRaw,
      } = req.body;

      const swapType: "face" | "fullbody" =
        swapTypeRaw === "face" ? "face" : "fullbody";

      const folderId = folderIdRaw ? parseInt(folderIdRaw) : undefined;

      const voiceIds: (string | null | undefined)[] = voiceIdsRaw
        ? typeof voiceIdsRaw === "string"
          ? JSON.parse(voiceIdsRaw)
          : voiceIdsRaw
        : voiceId
          ? [voiceId]
          : [];

      const autoDetect = autoDetectRaw === "true" || autoDetectRaw === true;

      const imageKeys: string[] = imageKeysRaw
        ? typeof imageKeysRaw === "string"
          ? JSON.parse(imageKeysRaw)
          : imageKeysRaw
        : [];

      const files = req.files as {
        video?: Express.Multer.File[];
        images?: Express.Multer.File[];
      };

      if (!files?.video?.[0]) {
        return res.status(400).json({ error: "Video file is required" });
      }

      const totalJobs =
        imageKeys.length > 0 ? imageKeys.length : files?.images?.length || 0;

      if (totalJobs === 0) {
        return res
          .status(400)
          .json({ error: "At least one image is required" });
      }

      const uploadedFiles = files?.images || [];
      let uploadedFileIndex = 0;
      const imageSources: Array<{ type: "file" | "s3key"; value: string }> = [];

      for (let i = 0; i < totalJobs; i++) {
        if (imageKeys.length > 0 && imageKeys[i] && imageKeys[i] !== "") {
          imageSources.push({ type: "s3key", value: imageKeys[i] });
        } else if (uploadedFiles[uploadedFileIndex]) {
          imageSources.push({
            type: "file",
            value: uploadedFiles[uploadedFileIndex].path,
          });
          uploadedFileIndex++;
        } else {
          return res
            .status(400)
            .json({ error: `Missing image for job ${i + 1}` });
        }
      }

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      let segments: SegmentInput[] = [];
      let sortedSegments: SegmentInput[] = [];

      if (!autoDetect) {
        if (segmentsRaw) {
          segments =
            typeof segmentsRaw === "string"
              ? JSON.parse(segmentsRaw)
              : segmentsRaw;
        } else {
          return res
            .status(400)
            .json({ error: "segments are required (or set autoDetect=true)" });
        }

        if (segments.length === 0 || segments.length > 5) {
          return res.status(400).json({ error: "Must provide 1-5 segments" });
        }

        let totalDuration = 0;
        for (const seg of segments) {
          if (seg.start >= seg.end) {
            return res
              .status(400)
              .json({ error: "Each segment must have start < end" });
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
          error:
            "UGC Studio is only available on Studio, Scale, and Enterprise plans.",
          code: "PLAN_REQUIRED",
        });
      }

      const totalCreditCost = totalJobs * UGC_CREDIT_COST;
      if (usage.totalRemaining < totalCreditCost) {
        return res.status(403).json({
          error: `Insufficient credits. ${totalJobs} face swaps require ${totalCreditCost} credits, but you have ${usage.totalRemaining} remaining.`,
          code: INSUFFICIENT_CREDITS,
        });
      }

      if (idempotencyKey) {
        const cached = checkIdempotency(idempotencyKey);
        if (cached) {
          console.log(
            `[comfy] Returning cached job for idempotency key: ${idempotencyKey}`,
          );
          return res.status(202).json({
            message: "Jobs already queued (retry detected)",
            jobIds: [cached.jobId],
          });
        }
      }

      await teamService.incrementTeamUsage(parseInt(teamId), totalCreditCost);
      console.log(
        `[comfy] Charged ${totalCreditCost} credits upfront to team ${teamId}`,
      );

      const jobIds: string[] = [];
      const now = new Date();

      for (let i = 0; i < totalJobs; i++) {
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

      console.log(
        `[comfy] Created ${jobIds.length} jobs with pending_upload status`,
      );

      if (idempotencyKey) {
        setIdempotency(idempotencyKey, jobIds[0]);
      }

      res.status(202).json({
        message: "Jobs created, upload in progress",
        jobIds,
      });

      const videoDuration = parseFloat(videoDurationRaw) || 0;

      processBackgroundUpload({
        jobIds,
        teamId: parseInt(teamId),
        userId: req.user!.dbUserId,
        videoPath: files.video[0].path,
        imageSources,
        segments: sortedSegments,
        videoDuration,
        spliceWithOriginal:
          spliceWithOriginal === "true" || spliceWithOriginal === true,
        autoDetect,
        folderId,
        voiceIds,
        swapType,
      }).catch((err) => {
        console.error("[comfy] Background upload failed:", err);
        Sentry.captureException(err);
      });
    } catch (error) {
      return handleControllerError(res, "Create UGC face swap upload error", error, "Failed to create jobs");
    }
  }

  async getSavedFaces(req: AuthRequest, res: Response<{ faces: Record<string, any>[] } | ErrorResponse>) {
    try {
      const { teamId } = req.params;

      if (!teamId) {
        return res.status(400).json({ error: "Team ID required" });
      }

      if (!(await verifyTeamAccessOrFail(req, parseInt(teamId), res))) return;

      const faces = await db
        .select()
        .from(savedFaces)
        .where(eq(savedFaces.team_id, parseInt(teamId)))
        .orderBy(desc(savedFaces.created_at));

      const facesWithUrls = await Promise.all(
        faces.map(async (face) => ({
          id: face.id,
          name: face.name,
          imageKey: face.image_key,
          imageUrl: await s3Service.getPresignedUrl(face.image_key, 3600),
          createdAt: face.created_at,
        })),
      );

      return res.status(200).json({ faces: facesWithUrls });
    } catch (error) {
      return handleControllerError(res, "Get saved faces error", error, "Failed to get saved faces");
    }
  }

  async saveFace(req: AuthRequest, res: Response<{ face: Record<string, any> } | ErrorResponse>) {
    try {
      const { teamId, name } = req.body;
      const file = req.file;

      if (!teamId || !name) {
        return res.status(400).json({ error: "teamId and name are required" });
      }

      if (!file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      const imageExt = path.extname(file.originalname) || ".jpg";
      const imageS3Key = `saved-faces/${teamId}/${crypto.randomUUID()}${imageExt}`;

      await s3Service.uploadBuffer(file.buffer, imageS3Key, file.mimetype);

      const [newFace] = await db
        .insert(savedFaces)
        .values({
          team_id: parseInt(teamId),
          name,
          image_key: imageS3Key,
        })
        .returning();

      const imageUrl = await s3Service.getPresignedUrl(imageS3Key, 3600);

      console.log(`[comfy] Saved face "${name}" for team ${teamId}`);

      return res.status(201).json({
        face: {
          id: newFace.id,
          name: newFace.name,
          imageKey: imageS3Key,
          imageUrl,
          createdAt: newFace.created_at,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Save face error", error, "Failed to save face");
    }
  }

  async deleteSavedFace(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Face ID required" });
      }

      const [face] = await db
        .select()
        .from(savedFaces)
        .where(eq(savedFaces.id, parseInt(id)));

      if (!face) {
        return res.status(404).json({ error: "Face not found" });
      }

      if (!(await verifyTeamAccessOrFail(req, face.team_id, res))) return;

      try {
        await s3Service.deleteObject(face.image_key);
      } catch (s3Error) {
        console.warn(`[comfy] Failed to delete S3 object: ${s3Error}`);
      }

      await db.delete(savedFaces).where(eq(savedFaces.id, parseInt(id)));

      console.log(`[comfy] Deleted saved face ${id}`);
      return res.status(200).json({ message: "Face deleted successfully" });
    } catch (error) {
      return handleControllerError(res, "Delete saved face error", error, "Failed to delete face");
    }
  }

  async generatePose(req: AuthRequest, res: Response) {
    try {
      const { teamId, videoFrameBase64, characterImageKey } = req.body;
      const file = req.file;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      if (!videoFrameBase64) {
        return res.status(400).json({ error: "videoFrameBase64 is required" });
      }

      if (!characterImageKey && !file) {
        return res.status(400).json({
          error: "Either characterImageKey or image file is required",
        });
      }

      const usage = await getTeamUsage(parseInt(teamId));
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }

      if (!canAccessUGCStudio(usage.plan)) {
        return res.status(403).json({
          error:
            "UGC Studio is only available on Studio, Scale, and Enterprise plans.",
          code: "PLAN_REQUIRED",
        });
      }

      console.log(`[comfy] Generating pose for team ${teamId}`);

      const frameBuffer = Buffer.from(
        videoFrameBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
      );
      const frameS3Key = `pose-generation/${teamId}/${crypto.randomUUID()}_frame.png`;
      await s3Service.uploadBuffer(frameBuffer, frameS3Key, "image/png");
      const videoFrameUrl = await s3Service.getPresignedUrl(frameS3Key, 3600);

      let faceImageUrl: string;
      if (characterImageKey) {
        faceImageUrl = await s3Service.getPresignedUrl(characterImageKey, 3600);
      } else if (file) {
        const imageS3Key = `pose-generation/${teamId}/${crypto.randomUUID()}_face.${path.extname(file.originalname) || "jpg"}`;
        await s3Service.uploadBuffer(file.buffer, imageS3Key, file.mimetype);
        faceImageUrl = await s3Service.getPresignedUrl(imageS3Key, 3600);
      } else {
        return res.status(400).json({ error: "No character image provided" });
      }

      console.log(
        `[comfy] Generating pose with nano-banana-2 - character first, pose reference second`,
      );
      const result = await falImageService.generateImageWithReferences({
        prompt: POSE_GENERATION_PROMPT,
        imageUrls: [faceImageUrl, videoFrameUrl],
        aspectRatio: "auto",
        numImages: 1,
      });

      console.log(`[comfy] Pose generation complete for team ${teamId}`);

      return res.status(200).json({
        imageUrl: result.imageUrl,
      });
    } catch (error) {
      return handleControllerError(res, "Generate pose error", error, "Failed to generate pose");
    }
  }
}

export const comfyController = new ComfyController();
