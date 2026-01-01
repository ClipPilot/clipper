import { Request, Response } from "express";
import { db } from "../db";
import { comfyJobs } from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { getVideoDuration, cutClip } from "../services/videoEditor.service";
import { emitComfyJobUpdate } from "../services/socket.service";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import "multer";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

export class ComfyController {
  async createUGCFaceSwapJob(req: AuthRequest, res: Response) {
    const MAX_VIDEO_DURATION = 30;
    let tempVideoPath: string | null = null;
    let trimmedVideoPath: string | null = null;

    try {
      const { teamId, startTime, endTime } = req.body;
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

      const start = parseFloat(startTime) || 0;
      const end = parseFloat(endTime) || 0;
      const clipDuration = end - start;

      if (clipDuration <= 0 || clipDuration > MAX_VIDEO_DURATION + 0.1) {
        return res.status(400).json({
          error: `Clip duration must be between 0 and ${MAX_VIDEO_DURATION} seconds`,
        });
      }

      trimmedVideoPath = path.join(tempDir, `${crypto.randomUUID()}_trimmed.mp4`);
      await cutClip(tempVideoPath, trimmedVideoPath, start, end);

      const imageExt = path.extname(image.originalname) || ".jpg";
      const imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${imageExt}`;
      const videoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}.mp4`;

      const trimmedBuffer = fs.readFileSync(trimmedVideoPath);
      await Promise.all([
        s3Service.uploadBuffer(image.buffer, imageS3Key, image.mimetype),
        s3Service.uploadBuffer(trimmedBuffer, videoS3Key, "video/mp4"),
      ]);

      // Create job in DB
      const [job] = await db
        .insert(comfyJobs)
        .values({
          teamId: parseInt(teamId),
          status: "queued",
          imageFile: imageS3Key,
          videoFile: videoS3Key,
          jobType: "ugc-face-swap-parent",
          priority: Math.floor(Date.now() / 1000),
          originalVideoS3Key: videoS3Key,
          progress: 0,
          progressMessage: "Waiting for GPU...",
        })
        .returning();

      emitComfyJobUpdate(parseInt(teamId), {
        id: job.id,
        status: "queued",
        progress: 0,
        progressMessage: "Waiting for GPU...",
        outputUrl: null,
        errorMessage: null,
        createdAt: job.createdAt.toISOString(),
        finishedAt: null,
      });

      return res.status(202).json({
        message: "UGC face swap job queued",
        jobId: job.id,
        duration: Math.round(clipDuration),
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
      if (trimmedVideoPath && fs.existsSync(trimmedVideoPath)) {
        fs.unlinkSync(trimmedVideoPath);
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
