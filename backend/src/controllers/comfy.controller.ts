import { Request, Response } from "express";
import { comfyService } from "../services/comfy.service";
import "multer";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

export class ComfyController {
  async uploadInputs(req: Request, res: Response) {
    try {
      const files = req.files as {
        image?: Express.Multer.File[];
        video?: Express.Multer.File[];
      };

      const image = files?.image?.[0];
      const video = files?.video?.[0];

      if (!image || !video) {
        return res.status(400).json({
          error: "Both image and video files are required",
        });
      }

      // Basic validation
      if (!image.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Invalid image file type" });
      }

      if (!video.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Invalid video file type" });
      }

      const result = await comfyService.uploadInputs({
        image,
        video,
      });

      return res.status(200).json(result);
    } catch (error) {
      console.error("Comfy upload error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to upload inputs",
      });
    }
  }

  async createJob(req: AuthRequest, res: Response) {
    try {
      const { teamId, imageFile, videoFile } = req.body;

      if (!teamId || !imageFile || !videoFile) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const job = await comfyService.createJob({
        teamId,
        imageFile,
        videoFile,
      });

      return res.status(201).json({ job });
    } catch (error) {
      console.error("Create job error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create job",
      });
    }
  }

  async getJobStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "Job ID required" });
      }

      const job = await comfyService.getJob(jobId);

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

  async assignNextJob(req: Request, res: Response) {
    try {
      const { podId } = req.body;

      if (!podId) {
        return res.status(400).json({ error: "Pod ID required" });
      }

      const job = await comfyService.assignNextJob(podId);

      return res.status(200).json({ job });
    } catch (error) {
      console.error("Assign job error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to assign job",
      });
    }
  }

  async updateProgress(req: Request, res: Response) {
    try {
      const { jobId, progress, message } = req.body;

      if (!jobId || progress === undefined) {
        return res.status(400).json({ error: "Job ID and progress required" });
      }

      const job = await comfyService.updateProgress(jobId, progress, message);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      return res.status(200).json({ job });
    } catch (error) {
      console.error("Update progress error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to update progress",
      });
    }
  }

  async completeJob(req: Request, res: Response) {
    try {
      const { jobId, success, outputFile, errorMessage } = req.body;

      if (!jobId || success === undefined) {
        return res.status(400).json({ error: "Job ID and success required" });
      }

      const job = await comfyService.completeJob(
        jobId,
        success,
        outputFile,
        errorMessage
      );

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      return res.status(200).json({ job });
    } catch (error) {
      console.error("Complete job error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to complete job",
      });
    }
  }
}

export const comfyController = new ComfyController();
