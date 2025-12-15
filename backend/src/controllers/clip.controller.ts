import { Response } from "express";
import fs from "fs";
import path from "path";
import { teamService } from "../services/team.service";
import { clipManagerService } from "../services/clipManager.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { compressVideoForUpload } from "../services/videoEditor.service";

export const clipVideoController = async (req: AuthRequest, res: Response) => {
  let uploadedFilePath: string | undefined;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    uploadedFilePath = req.file.path;

    const teamId = req.body.teamId ? parseInt(req.body.teamId) : null;
    if (!teamId) {
      return res.status(400).json({ error: "Team ID is required" });
    }

    const numberOfVideos = req.body.numberOfVideos
      ? parseInt(req.body.numberOfVideos)
      : 1;

    const usageStats = await teamService.getTeamUsageStats(teamId);
    const remaining = usageStats.limit - usageStats.clips_created;

    if (remaining < numberOfVideos) {
      return res.status(403).json({
        error: "Usage limit reached",
        message: `You have used all ${usageStats.limit} clips for this period. Resets on ${new Date(
          usageStats.resets_date
        ).toLocaleDateString()}.`,
        usage: {
          clipsCreated: usageStats.clips_created,
          limit: usageStats.limit,
          remaining,
          resetsDate: usageStats.resets_date,
        },
      });
    }

    const length = req.body.length ? parseInt(req.body.length) : undefined;
    const hookLength = req.body.hookLength
      ? parseInt(req.body.hookLength)
      : undefined;
    const promptType = req.body.promptType as "business" | "viral" | undefined;
    const customPrompt = req.body.customPrompt as string | undefined;
    const textPrompt = req.body.textPrompt as string | undefined;
    const customText = req.body.customText as string | undefined;
    const textPosition = req.body.textPosition as
      | "top"
      | "bottom"
      | "middle"
      | undefined;
    const textColor = req.body.textColor as string | undefined;
    const captions = req.body.captions === "true" || req.body.captions === true;
    const captionColor = req.body.captionColor as string | undefined;

    if (length && (length < 10 || length > 120)) {
      return res
        .status(400)
        .json({ error: "Length must be between 10 and 120 seconds" });
    }

    if (hookLength && (hookLength < 2 || hookLength > 15)) {
      return res
        .status(400)
        .json({ error: "Hook length must be between 2 and 15 seconds" });
    }

    if (promptType && !["business", "viral"].includes(promptType)) {
      return res
        .status(400)
        .json({ error: 'Prompt type must be either "business" or "viral"' });
    }

    if (textPosition && !["top", "middle", "bottom"].includes(textPosition)) {
      return res
        .status(400)
        .json({ error: 'Text position must be "top", "middle", or "bottom"' });
    }

    if (numberOfVideos && (numberOfVideos < 1 || numberOfVideos > 5)) {
      return res
        .status(400)
        .json({ error: "Number of videos must be between 1 and 5" });
    }

    const userId = req.user!.dbUserId;
    const pendingClips: any[] = [];

    for (let i = 0; i < numberOfVideos; i++) {
      const clip = await clipManagerService.createPendingClip({
        teamId,
        userId,
      });
      pendingClips.push(clip);
    }

    await teamService.incrementTeamUsage(teamId, numberOfVideos);

    const clipIds = pendingClips.map((c) => c.id);

    res.json({
      clipIds,
      message: `Processing ${numberOfVideos} clip(s)`,
      status: "queued",
    });

    const filePath = uploadedFilePath;
    const originalFileName = req.file?.originalname;
    const fileSize = req.file?.size;

    setImmediate(async () => {
      let compressedPath: string | undefined;

      try {
        const compressedOutputPath = path.join(
          path.dirname(filePath),
          `compressed_${Date.now()}_${path.basename(filePath)}`
        );

        const compression = await compressVideoForUpload(filePath, compressedOutputPath);
        const uploadPath = compression.path;
        compressedPath = compression.compressed ? compressedOutputPath : undefined;

        console.log("Uploading raw video to S3 for worker processing...");
        const s3Key = await s3Service.uploadRawVideo(uploadPath, teamId);
        console.log(`Raw video uploaded to S3: ${s3Key}`);

        const messageId = await sqsService.sendClipVideoJob({
          clipIds,
          teamId,
          userId,
          s3Key,
          options: {
            length,
            hookLength,
            promptType,
            customPrompt,
            textPrompt,
            numberOfVideos,
            customText,
            textPosition,
            textColor,
            captions,
            captionColor,
          },
          originalFileName,
          fileSize,
        });

        console.log(`Job sent to SQS with messageId: ${messageId}`);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        if (compressedPath && fs.existsSync(compressedPath)) {
          fs.unlinkSync(compressedPath);
        }
      } catch (error) {
        console.error("Error uploading to S3 or sending to SQS:", error);

        for (const clipId of clipIds) {
          await clipManagerService.updateClipStatus(
            clipId,
            teamId,
            "failed",
            error instanceof Error ? error.message : "Failed to queue job"
          );
        }

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        if (compressedPath && fs.existsSync(compressedPath)) {
          fs.unlinkSync(compressedPath);
        }
      }
    });

    return;
  } catch (err) {
    console.error("Error in clipVideoController:", err);

    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to process video",
    });
  }
};
