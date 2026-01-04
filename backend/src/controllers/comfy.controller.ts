import { Request, Response } from "express";
import { db } from "../db";
import { comfyJobs } from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { cutClip, mergeClips } from "../services/videoEditor.service";
import { emitComfyJobUpdate } from "../services/socket.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import "multer";

const UGC_CREDIT_COST = 5;

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
  async createUGCFaceSwapJob(req: AuthRequest, res: Response) {
    const MAX_VIDEO_DURATION = 50;
    let tempVideoPath: string | null = null;
    let mergedVideoPath: string | null = null;
    const segmentPaths: string[] = [];

    try {
      const { teamId, startTime, endTime, segments: segmentsRaw, videoDuration: videoDurationRaw } = req.body;
      const videoDuration = parseFloat(videoDurationRaw) || 0;
      const files = req.files as {
        image?: Express.Multer.File[];
        video?: Express.Multer.File[];
      };

      const image = files?.image?.[0];
      const video = files?.video?.[0];

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      if (!image || !video) {
        return res.status(400).json({
          error: "Both image and video files are required",
        });
      }

      if (!image.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid image file type" });
      }

      if (!video.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Invalid video file type" });
      }

      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      tempVideoPath = path.join(tempDir, `${crypto.randomUUID()}.mp4`);
      fs.writeFileSync(tempVideoPath, video.buffer);

      let segments: SegmentInput[];
      if (segmentsRaw) {
        segments = JSON.parse(segmentsRaw);
      } else {
        segments = [{ start: parseFloat(startTime) || 0, end: parseFloat(endTime) || 0 }];
      }

      if (segments.length === 0 || segments.length > 3) {
        return res.status(400).json({ error: "Must provide 1-3 segments" });
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
          error: "UGC Studio is only available on Scale and Enterprise plans. Please upgrade to access this feature.",
          code: "PLAN_REQUIRED",
          requiredPlan: "scale",
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

      await teamService.incrementTeamUsage(parseInt(teamId), UGC_CREDIT_COST);
      console.log(`[comfy] Charged ${UGC_CREDIT_COST} credits upfront to team ${teamId}`);

      for (let i = 0; i < segments.length; i++) {
        const segPath = path.join(tempDir, `${crypto.randomUUID()}_segment_${i}.mp4`);
        await cutClip(tempVideoPath, segPath, segments[i].start, segments[i].end);
        segmentPaths.push(segPath);
      }

      let finalVideoPath: string;
      if (segmentPaths.length === 1) {
        finalVideoPath = segmentPaths[0];
      } else {
        mergedVideoPath = path.join(tempDir, `${crypto.randomUUID()}_merged.mp4`);
        await mergeClips(segmentPaths, mergedVideoPath);
        finalVideoPath = mergedVideoPath;
      }

      const imageExt = path.extname(image.originalname) || ".jpg";
      const imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${imageExt}`;
      const videoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}.mp4`;

      const isSpliceMode = segments.length >= 2 && videoDuration > 0;
      const spliceMetadata = isSpliceMode
        ? { videoDuration, segments: calculateSpliceSegments(segments, videoDuration) }
        : null;

      const finalBuffer = fs.readFileSync(finalVideoPath);
      const uploads: Promise<string>[] = [
        s3Service.uploadBuffer(image.buffer, imageS3Key, image.mimetype),
        s3Service.uploadBuffer(finalBuffer, videoS3Key, "video/mp4"),
      ];

      let originalVideoS3Key = videoS3Key;
      if (isSpliceMode) {
        originalVideoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}_original.mp4`;
        const originalBuffer = fs.readFileSync(tempVideoPath);
        uploads.push(s3Service.uploadBuffer(originalBuffer, originalVideoS3Key, "video/mp4"));
      }

      await Promise.all(uploads);

      const [job] = await db
        .insert(comfyJobs)
        .values({
          teamId: parseInt(teamId),
          status: "queued",
          imageFile: imageS3Key,
          videoFile: videoS3Key,
          jobType: "ugc-face-swap-parent",
          priority: Math.floor(Date.now() / 1000),
          originalVideoS3Key,
          spliceMode: isSpliceMode,
          spliceMetadata,
          progress: 0,
          progressMessage: "Queuing job",
        })
        .returning();

      emitComfyJobUpdate(parseInt(teamId), {
        id: job.id,
        status: "queued",
        progress: 0,
        progressMessage: "Queuing job",
        outputUrl: null,
        errorMessage: null,
        createdAt: job.createdAt.toISOString(),
        finishedAt: null,
      });

      return res.status(202).json({
        message: "UGC face swap job queued",
        jobId: job.id,
        duration: Math.round(totalDuration),
      });
    } catch (error) {
      console.error("Create UGC face swap job error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to queue job",
      });
    } finally {
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      for (const segPath of segmentPaths) {
        if (fs.existsSync(segPath)) fs.unlinkSync(segPath);
      }
      if (mergedVideoPath && fs.existsSync(mergedVideoPath)) {
        fs.unlinkSync(mergedVideoPath);
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
        })
        .from(comfyJobs)
        .where(eq(comfyJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Generate signed URL if job has output file
      let outputUrl: string | null = null;
      if (job.outputFile) {
        // Handle legacy s3:// URIs by extracting the key
        const s3Key = job.outputFile.startsWith("s3://")
          ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
          : job.outputFile;
        outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
      }

      return res.status(200).json({
        job: {
          ...job,
          outputUrl,
        },
      });
    } catch (error) {
      console.error("Get job error:", error);
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
        })
        .from(comfyJobs)
        .where(eq(comfyJobs.teamId, parseInt(teamId)))
        .orderBy(desc(comfyJobs.createdAt))
        .limit(20);

      // Generate signed URLs for completed jobs
      const jobsWithUrls = await Promise.all(
        jobs.map(async (job) => {
          let outputUrl: string | null = null;
          if (job.outputFile) {
            // Handle legacy s3:// URIs by extracting the key
            const s3Key = job.outputFile.startsWith("s3://")
              ? job.outputFile.replace(/^s3:\/\/[^/]+\//, "")
              : job.outputFile;
            outputUrl = await s3Service.getPresignedUrl(s3Key, 3600);
          }
          return { ...job, outputUrl };
        })
      );

      return res.status(200).json({ jobs: jobsWithUrls });
    } catch (error) {
      console.error("Get team jobs error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get jobs",
      });
    }
  }
}

export const comfyController = new ComfyController();
