import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { clipManagerService } from "../services/clipManager.service";

export const getPresignedUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { teamId, fileName, contentType, fileSize } = req.body;

    if (!teamId || !fileName || !contentType) {
      return res.status(400).json({ error: "Missing required fields: teamId, fileName, contentType" });
    }

    const MAX_FILE_SIZE = 1.5 * 1024 * 1024 * 1024;
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: "File size exceeds maximum limit of 1.5GB" });
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

    if (parsedNumberOfVideos < 1 || parsedNumberOfVideos > 5) {
      return res.status(400).json({ error: "Number of videos must be between 1 and 5" });
    }

    const usageStats = await teamService.getTeamUsageStats(parsedTeamId);
    const remaining = usageStats.limit - usageStats.clips_created;

    if (remaining < parsedNumberOfVideos) {
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

    for (let i = 0; i < parsedNumberOfVideos; i++) {
      const clip = await clipManagerService.createPendingClip({
        teamId: parsedTeamId,
        userId,
      });
      pendingClips.push(clip);
    }

    await teamService.incrementTeamUsage(parsedTeamId, parsedNumberOfVideos);

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
