import { Response } from "express";
import * as Sentry from "@sentry/node";
import { AdminRequest } from "../middleware/admin.middleware";
import { adminClipFactoryService } from "../services/admin-clip-factory.service";
import { teamService } from "../services/team.service";
import { isValidPromptType } from "../constants/promptTypes";
import { isValidConversionMode } from "../constants/conversionModes";

const VALID_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];

export async function getPresignedUrl(req: AdminRequest, res: Response) {
  try {
    const { teamId, fileName, contentType } = req.body;
    if (!teamId || !fileName || !contentType) {
      return res.status(400).json({ error: "Missing required fields: teamId, fileName, contentType" });
    }

    if (!VALID_VIDEO_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type. Supported: MP4, MOV, AVI, MKV, WebM" });
    }

    const result = await adminClipFactoryService.getPresignedUploadUrl(parseInt(teamId), fileName, contentType);
    return res.json(result);
  } catch (err) {
    console.error("Error generating presigned URL:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
}

export async function initiateMultipart(req: AdminRequest, res: Response) {
  try {
    const { teamId, fileName, contentType, fileSize } = req.body;
    if (!teamId || !fileName || !contentType || !fileSize) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!VALID_VIDEO_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const result = await adminClipFactoryService.initiateMultipartUpload(parseInt(teamId), fileName, contentType, fileSize);
    return res.json(result);
  } catch (err) {
    console.error("Error initiating multipart upload:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to initiate upload" });
  }
}

export async function completeMultipart(req: AdminRequest, res: Response) {
  try {
    const { s3Key, uploadId, parts } = req.body;
    if (!s3Key || !uploadId || !parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedParts = parts.map((p: Record<string, unknown>) => ({
      partNumber: (p.partNumber ?? p.PartNumber) as number,
      etag: (p.etag ?? p.ETag) as string,
    }));
    const result = await adminClipFactoryService.completeMultipartUpload(s3Key, uploadId, normalizedParts);
    return res.json(result);
  } catch (err) {
    console.error("Error completing multipart upload:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to complete upload" });
  }
}

export async function startClipFactory(req: AdminRequest, res: Response) {
  try {
    const { teamId, videos, options } = req.body;

    if (!teamId || !videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: "Missing required fields: teamId, videos (non-empty array)" });
    }

    for (const video of videos) {
      if (!video.s3Key || !video.originalFileName) {
        return res.status(400).json({ error: "Each video must have s3Key and originalFileName" });
      }
    }

    if (!options || typeof options !== "object") {
      return res.status(400).json({ error: "Missing options object" });
    }

    const loops = parseInt(options.numberOfVideos) || 1;
    if (loops < 1 || loops > 100) {
      return res.status(400).json({ error: "numberOfVideos must be between 1 and 100" });
    }

    if (options.length && (options.length < 10 || options.length > 180)) {
      return res.status(400).json({ error: "Clip length must be between 10 and 180 seconds" });
    }

    if (options.hookLength && (options.hookLength < 2 || options.hookLength > 15)) {
      return res.status(400).json({ error: "Hook length must be between 2 and 15 seconds" });
    }

    if (options.promptType && !isValidPromptType(options.promptType)) {
      return res.status(400).json({ error: "Invalid prompt type" });
    }

    if (options.conversionMode && !isValidConversionMode(options.conversionMode)) {
      return res.status(400).json({ error: "Invalid conversion mode" });
    }

    const parsedTeamId = parseInt(teamId);
    await teamService.getTeamById(parsedTeamId);
    const userId = await adminClipFactoryService.getTeamOwnerUserId(parsedTeamId);

    const result = await adminClipFactoryService.startClipJobs(
      parsedTeamId,
      userId,
      videos,
      { ...options, numberOfVideos: 1, captions: options.captions === true },
      loops
    );

    return res.json(result);
  } catch (err) {
    console.error("Error starting clip factory:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to start clip jobs" });
  }
}

export async function getClipFactoryStatus(req: AdminRequest, res: Response) {
  try {
    const { rawVideoPublicIds, teamId } = req.body;

    if (!rawVideoPublicIds || !Array.isArray(rawVideoPublicIds) || rawVideoPublicIds.length === 0) {
      return res.status(400).json({ error: "Missing rawVideoPublicIds array" });
    }

    if (!teamId) {
      return res.status(400).json({ error: "Missing teamId" });
    }

    const result = await adminClipFactoryService.getJobStatuses(rawVideoPublicIds, parseInt(teamId));
    return res.json(result);
  } catch (err) {
    console.error("Error getting clip factory status:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get job status" });
  }
}

export async function getActiveJobs(req: AdminRequest, res: Response) {
  try {
    const teamId = req.query.teamId as string;
    if (!teamId) {
      return res.status(400).json({ error: "Missing teamId" });
    }

    const jobs = await adminClipFactoryService.getActiveJobs(parseInt(teamId));
    return res.json({ jobs });
  } catch (err) {
    console.error("Error getting active jobs:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to get active jobs" });
  }
}
