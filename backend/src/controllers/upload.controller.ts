import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { clipManagerService } from "../services/clipManager.service";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

export const initiateMultipartUpload = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { teamId, fileName, contentType, fileSize } = req.body;

    if (!teamId || !fileName || !contentType || !fileSize) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: "File size exceeds maximum limit of 2GB" });
    }

    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const { uploadId, s3Key } = await s3Service.initiateMultipartUpload(
      parseInt(teamId),
      fileName,
      contentType
    );

    const totalParts = Math.ceil(fileSize / CHUNK_SIZE);
    const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);

    const partUrls = await s3Service.getPresignedPartUrls(s3Key, uploadId, partNumbers);

    return res.json({
      uploadId,
      s3Key,
      chunkSize: CHUNK_SIZE,
      totalParts,
      partUrls,
    });
  } catch (err) {
    console.error("Error initiating multipart upload:", err);
    return res.status(500).json({ error: "Failed to initiate upload" });
  }
};

export const completeMultipartUpload = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { s3Key, uploadId, parts } = req.body;

    if (!s3Key || !uploadId || !parts || !Array.isArray(parts)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await s3Service.completeMultipartUpload(s3Key, uploadId, parts);

    return res.json({ success: true, s3Key });
  } catch (err) {
    console.error("Error completing multipart upload:", err);
    return res.status(500).json({ error: "Failed to complete upload" });
  }
};

export const abortMultipartUpload = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { s3Key, uploadId } = req.body;

    if (!s3Key || !uploadId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await s3Service.abortMultipartUpload(s3Key, uploadId);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error aborting multipart upload:", err);
    return res.status(500).json({ error: "Failed to abort upload" });
  }
};

export const getPresignedUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { teamId, fileName, contentType, fileSize } = req.body;

    if (!teamId || !fileName || !contentType) {
      return res.status(400).json({ error: "Missing required fields: teamId, fileName, contentType" });
    }

    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: "File size exceeds maximum limit of 2GB" });
    }

    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm"];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type. Supported: MP4, MOV, AVI, MKV, WebM" });
    }

    const { uploadUrl, s3Key } = await s3Service.getPresignedUploadUrl(
      parseInt(teamId),
      fileName,
      contentType,
      3600
    );

    return res.json({ uploadUrl, s3Key });
  } catch (err) {
    console.error("Error generating presigned URL:", err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

export const submitClipJob = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      teamId,
      s3Key,
      originalFileName,
      fileSize,
      length,
      hookLength,
      promptType,
      customPrompt,
      textPrompt,
      numberOfVideos = 1,
      customText,
      textPosition,
      textColor,
      captions,
      captionColor,
      captionFont,
    } = req.body;

    if (!teamId || !s3Key) {
      return res.status(400).json({ error: "Missing required fields: teamId, s3Key" });
    }

    const parsedTeamId = parseInt(teamId);
    const parsedNumberOfVideos = parseInt(numberOfVideos) || 1;

    if (parsedNumberOfVideos < 1 || parsedNumberOfVideos > 25) {
      return res.status(400).json({ error: "Number of videos must be between 1 and 25" });
    }

    const team = await teamService.getTeamById(parsedTeamId);
    const plan = team.plan || "free";

    if (plan === "free") {
      const usageStats = await teamService.getTeamUsageStats(parsedTeamId);
      const remaining = usageStats.limit - usageStats.clips_created;

      if (remaining <= 0) {
        return res.status(403).json({
          error: "Usage limit reached",
          message: `You have used all ${usageStats.limit} clips for this period.`,
          usage: {
            clipsCreated: usageStats.clips_created,
            limit: usageStats.limit,
            remaining,
            resetsDate: usageStats.resets_date,
          },
        });
      }
    }

    if (length && (length < 10 || length > 120)) {
      return res.status(400).json({ error: "Length must be between 10 and 120 seconds" });
    }

    if (hookLength && (hookLength < 2 || hookLength > 15)) {
      return res.status(400).json({ error: "Hook length must be between 2 and 15 seconds" });
    }

    if (promptType && !["business", "viral"].includes(promptType)) {
      return res.status(400).json({ error: 'Prompt type must be either "business" or "viral"' });
    }

    if (textPosition && !["top", "middle", "bottom"].includes(textPosition)) {
      return res.status(400).json({ error: 'Text position must be "top", "middle", or "bottom"' });
    }

    const userId = req.user.dbUserId;
    const pendingClips: any[] = [];

    // Create raw video record to track the uploaded video
    const rawVideo = await clipManagerService.createRawVideo({
      teamId: parsedTeamId,
      videoPath: s3Key,
    });

    for (let i = 0; i < parsedNumberOfVideos; i++) {
      const clip = await clipManagerService.createPendingClip({
        teamId: parsedTeamId,
        userId,
        rawVideoId: rawVideo.id,
      });
      pendingClips.push(clip);
    }

    const clipIds = pendingClips.map((c) => c.id);

    const messageId = await sqsService.sendClipVideoJob({
      clipIds,
      teamId: parsedTeamId,
      userId,
      s3Key,
      options: {
        length: length ? parseInt(length) : undefined,
        hookLength: hookLength ? parseInt(hookLength) : undefined,
        promptType,
        customPrompt,
        textPrompt,
        numberOfVideos: parsedNumberOfVideos,
        customText,
        textPosition,
        textColor,
        captions: captions === true || captions === "true",
        captionColor,
        captionFont,
      },
      originalFileName,
      fileSize: fileSize ? parseInt(fileSize) : undefined,
    });

    console.log(`Job sent to SQS with messageId: ${messageId}`);

    return res.json({
      clipIds,
      message: `Processing ${parsedNumberOfVideos} clip(s)`,
      status: "queued",
    });
  } catch (err) {
    console.error("Error submitting clip job:", err);
    return res.status(500).json({ error: "Failed to submit job" });
  }
};
