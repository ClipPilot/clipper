import * as Sentry from "@sentry/node";
import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.middleware";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { clipManagerService } from "../services/clips/clipManager.service";
import { PLAN_LIMITS, getMaxUploadSizeForPlan } from "../config/stripe.config";
import { PROMPT_TYPES, isValidPromptType } from "../constants/promptTypes";

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const clipJobSchema = z.object({
  teamId: z.union([z.string(), z.number()]).transform(val => parseInt(String(val))),
  s3Key: z.string().min(1).max(500),
  originalFileName: z.string().max(255).optional(),
  fileSize: z.number().optional(),
  length: z.number().int().min(10).max(120).optional(),
  hookLength: z.number().int().min(2).max(15).optional(),
  numberOfVideos: z.union([z.string(), z.number()]).transform(val => parseInt(String(val)) || 1).default(1),
  promptType: z.string().optional(),
  customPrompt: z.string().max(2000).optional(),
  textPrompt: z.string().max(2000).optional(),
  customText: z.string().max(500).optional(),
  textPosition: z.enum(["top", "middle", "bottom"]).optional(),
  textColor: z.string().regex(hexColorRegex, "Invalid hex color").optional(),
  textFont: z.string().max(100).optional(),
  captions: z.boolean().optional(),
  captionColor: z.string().regex(hexColorRegex, "Invalid hex color").optional(),
  captionFont: z.string().max(100).optional(),
  conversionMode: z.enum(["standard", "gaming", "speaker-zoom", "center-crop", "active-speaker"]).optional(),
  textStyle: z.enum(["stroke", "instagram"]).optional(),
  autoHeading: z.boolean().optional(),
  headingInstructions: z.string().max(500).optional(),
  backgroundMusicS3Key: z.string().max(500).optional(),
});

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

/**
 * Checks whether a free-plan team has exceeded its generation limit.
 * Returns a 403-ready error payload if the limit is reached or exceeded,
 * or null if the request may proceed.
 */
async function checkFreePlanGenerationLimit(
  teamId: number,
  requestedCount: number
): Promise<{ error: string; message: string; usage: object } | null> {
  const stats = await teamService.getTeamUsageStats(teamId);
  const currentClipCount = await clipManagerService.getTeamClipsCount(teamId);
  const generationLimit = stats.limit === 0 ? 0 : PLAN_LIMITS.FREE.generations;
  const generationsRemaining = generationLimit - currentClipCount;

  if (generationsRemaining <= 0) {
    return {
      error: "Generation limit reached",
      message:
        generationLimit === 0
          ? "This team has no generation allowance. Upgrade to generate clips."
          : `You have generated all ${generationLimit} clips allowed on the free plan. Upgrade to generate unlimited clips.`,
      usage: {
        clipsGenerated: currentClipCount,
        generationLimit,
        generationsRemaining: 0,
      },
    };
  }

  if (requestedCount > generationsRemaining) {
    return {
      error: "Generation limit exceeded",
      message: `You can only generate ${generationsRemaining} more clip(s). You requested ${requestedCount}.`,
      usage: {
        clipsGenerated: currentClipCount,
        generationLimit,
        generationsRemaining,
      },
    };
  }

  return null;
}

export const initiateMultipartUpload = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { teamId, fileName, contentType, fileSize } = req.body;

    if (!teamId || !fileName || !contentType || !fileSize) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const team = await teamService.getTeamById(parseInt(teamId));
    const plan = team.plan || "free";
    const MAX_FILE_SIZE = getMaxUploadSizeForPlan(plan);
    if (fileSize > MAX_FILE_SIZE) {
      const limitGB = MAX_FILE_SIZE / (1024 * 1024 * 1024);
      return res.status(400).json({ error: `File size exceeds maximum limit of ${limitGB}GB for your plan` });
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
    Sentry.captureException(err);
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
    Sentry.captureException(err);
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
    Sentry.captureException(err);
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

    const team = await teamService.getTeamById(parseInt(teamId));
    const plan = team.plan || "free";
    const MAX_FILE_SIZE = getMaxUploadSizeForPlan(plan);
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      const limitGB = MAX_FILE_SIZE / (1024 * 1024 * 1024);
      return res.status(400).json({ error: `File size exceeds maximum limit of ${limitGB}GB for your plan` });
    }

    const validTypes = [
      "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm",
      "audio/mpeg", "audio/wav", "audio/aac", "audio/mp4",
    ];
    if (!validTypes.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type. Supported: MP4, MOV, AVI, MKV, WebM, MP3, WAV, AAC" });
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
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

export const submitClipJob = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parseResult = clipJobSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.issues.map(e => e.message).join(", ")
      });
    }

    const {
      teamId: parsedTeamId,
      s3Key,
      originalFileName,
      fileSize,
      length,
      hookLength,
      promptType,
      customPrompt,
      textPrompt,
      numberOfVideos: parsedNumberOfVideos,
      customText,
      textPosition,
      textColor,
      textFont,
      captions,
      captionColor,
      captionFont,
      conversionMode,
      textStyle,
      autoHeading,
      headingInstructions,
      backgroundMusicS3Key,
    } = parseResult.data;

    if (parsedNumberOfVideos < 1 || parsedNumberOfVideos > 25) {
      return res.status(400).json({ error: "Number of videos must be between 1 and 25" });
    }

    const team = await teamService.getTeamById(parsedTeamId);
    const plan = team.plan || "free";

    if (plan === "free") {
      const limitError = await checkFreePlanGenerationLimit(parsedTeamId, parsedNumberOfVideos);
      if (limitError) return res.status(403).json(limitError);
    }

    if (promptType && !isValidPromptType(promptType)) {
      return res.status(400).json({ error: `Prompt type must be one of: ${PROMPT_TYPES.join(", ")}` });
    }

    const userId = req.user.dbUserId;
    const pendingClips: any[] = [];

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
        length,
        hookLength,
        promptType: promptType as any,
        customPrompt,
        textPrompt,
        numberOfVideos: parsedNumberOfVideos,
        customText,
        textPosition,
        textColor,
        textFont,
        captions: captions === true,
        captionColor,
        captionFont,
        conversionMode,
        textStyle,
        autoHeading,
        headingInstructions,
        backgroundMusicS3Key,
      },
      originalFileName,
      fileSize,
    });

    console.log(`Job sent to SQS with messageId: ${messageId}`);

    return res.json({
      clipIds,
      message: `Processing ${parsedNumberOfVideos} clip(s)`,
      status: "queued",
    });
  } catch (err) {
    console.error("Error submitting clip job:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to submit job" });
  }
};

// Maximum videos allowed in a batch
const MAX_BATCH_VIDEOS = 5;
// Maximum duration per video in seconds (30 minutes)
const MAX_VIDEO_DURATION_SECONDS = 30 * 60;

export const submitBatchClipJob = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      teamId,
      videos,
      length,
      hookLength,
      promptType,
      customPrompt,
      textPrompt,
      numberOfVideos = 1,
      customText,
      textPosition,
      textColor,
      textFont,
      captions,
      captionColor,
      captionFont,
      conversionMode,
      textStyle,
      autoHeading,
      backgroundMusicS3Key,
    } = req.body;

    if (!teamId || !videos) {
      return res.status(400).json({ error: "Missing required fields: teamId, videos" });
    }

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: "Videos must be a non-empty array" });
    }

    if (videos.length > MAX_BATCH_VIDEOS) {
      return res.status(400).json({
        error: `Maximum ${MAX_BATCH_VIDEOS} videos allowed per batch`,
      });
    }

    // Validate each video entry
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      if (!video.s3Key) {
        return res.status(400).json({
          error: `Video at index ${i} missing required field: s3Key`,
        });
      }
      if (video.videoIndex === undefined || video.videoIndex < 0 || video.videoIndex > 4) {
        return res.status(400).json({
          error: `Video at index ${i} has invalid videoIndex (must be 0-4)`,
        });
      }
      // Validate video duration is provided and within limits (max 30 minutes)
      if (!video.duration || typeof video.duration !== "number") {
        return res.status(400).json({
          error: `Video at index ${i} missing required field: duration`,
        });
      }
      if (video.duration > MAX_VIDEO_DURATION_SECONDS) {
        return res.status(400).json({
          error: `Video "${video.originalFileName || `at index ${i}`}" exceeds maximum duration of 30 minutes`,
        });
      }
    }

    const parsedTeamId = parseInt(teamId);
    const parsedNumberOfVideos = parseInt(numberOfVideos) || 1;

    if (parsedNumberOfVideos < 1 || parsedNumberOfVideos > 25) {
      return res.status(400).json({ error: "Number of videos must be between 1 and 25" });
    }

    const team = await teamService.getTeamById(parsedTeamId);
    const plan = team.plan || "free";

    if (plan === "free") {
      const limitError = await checkFreePlanGenerationLimit(parsedTeamId, parsedNumberOfVideos);
      if (limitError) return res.status(403).json(limitError);
    }

    if (length && (length < 10 || length > 120)) {
      return res.status(400).json({ error: "Length must be between 10 and 120 seconds" });
    }

    if (hookLength && (hookLength < 2 || hookLength > 15)) {
      return res.status(400).json({ error: "Hook length must be between 2 and 15 seconds" });
    }

    if (promptType && !isValidPromptType(promptType)) {
      return res.status(400).json({ error: `Prompt type must be one of: ${PROMPT_TYPES.join(", ")}` });
    }

    if (textPosition && !["top", "middle", "bottom"].includes(textPosition)) {
      return res.status(400).json({ error: 'Text position must be "top", "middle", or "bottom"' });
    }

    const userId = req.user.dbUserId;
    const pendingClips: any[] = [];

    // Create raw video records for each uploaded video
    const rawVideoIds: number[] = [];
    for (const video of videos) {
      const rawVideo = await clipManagerService.createRawVideo({
        teamId: parsedTeamId,
        videoPath: video.s3Key,
      });
      rawVideoIds.push(rawVideo.id);
    }

    // Create pending clips (use first raw video as reference)
    for (let i = 0; i < parsedNumberOfVideos; i++) {
      const clip = await clipManagerService.createPendingClip({
        teamId: parsedTeamId,
        userId,
        rawVideoId: rawVideoIds[0], // Reference the first video
      });
      pendingClips.push(clip);
    }

    const clipIds = pendingClips.map((c) => c.id);

    // Format videos for SQS job
    const formattedVideos = videos.map((v: any) => ({
      s3Key: v.s3Key,
      videoIndex: v.videoIndex,
      originalFileName: v.originalFileName,
      fileSize: v.fileSize ? parseInt(v.fileSize) : undefined,
      duration: v.duration,
    }));

    const messageId = await sqsService.sendBatchClipVideoJob({
      clipIds,
      teamId: parsedTeamId,
      userId,
      videos: formattedVideos,
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
        textFont,
        captions: captions === true || captions === "true",
        captionColor,
        captionFont,
        conversionMode,
        textStyle,
        autoHeading,
        backgroundMusicS3Key,
      },
    });

    console.log(`Batch job sent to SQS with messageId: ${messageId}`);

    return res.json({
      clipIds,
      message: `Processing ${parsedNumberOfVideos} clip(s) from ${videos.length} source videos`,
      status: "queued",
    });
  } catch (err) {
    console.error("Error submitting batch clip job:", err);
    Sentry.captureException(err);
    return res.status(500).json({ error: "Failed to submit batch job" });
  }
};
