import { Request, Response } from "express";
import { db } from "../db";
import { comfyJobs } from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { getVideoDuration } from "../services/videoEditor.service";
import { eq } from "drizzle-orm";
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

    try {
      const { teamId } = req.body;
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

      // Write video to temp file to check duration
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      tempVideoPath = path.join(tempDir, `${crypto.randomUUID()}.mp4`);
      fs.writeFileSync(tempVideoPath, video.buffer);

      const duration = await getVideoDuration(tempVideoPath);
      if (duration > MAX_VIDEO_DURATION) {
        return res.status(400).json({
          error: `Video duration ${duration.toFixed(1)}s exceeds maximum ${MAX_VIDEO_DURATION}s`,
        });
      }

      // Upload to S3
      const imageExt = path.extname(image.originalname) || ".jpg";
      const videoExt = path.extname(video.originalname) || ".mp4";
      const imageS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${imageExt}`;
      const videoS3Key = `ugc-inputs/${teamId}/${crypto.randomUUID()}${videoExt}`;

      await Promise.all([
        s3Service.uploadBuffer(image.buffer, imageS3Key, image.mimetype),
        s3Service.uploadBuffer(video.buffer, videoS3Key, video.mimetype),
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

      return res.status(202).json({
        message: "UGC face swap job queued",
        jobId: job.id,
        duration: Math.round(duration),
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

      return res.status(200).json({ job });
    } catch (error) {
      console.error("Get job error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get job",
      });
    }
  }
}

export const comfyController = new ComfyController();
