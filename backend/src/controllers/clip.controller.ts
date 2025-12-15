import { Response } from "express";
import fs from "fs";
import { transcribeVideoService } from "../services/transcription.service";
import {
  generateClipSuggestionsService,
  ClipGenerationOptions,
} from "../services/aiSuggestions.service";
import { createMultipleCombinedClipsService } from "../services/clip.service";
import { teamService } from "../services/team.service";
import { clipManagerService } from "../services/clipManager.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { s3Service } from "../services/s3.service";
import { extractThumbnail } from "../utils/extractThumbnail";
import { emitClipsRefresh } from "../services/socket.service";
import { title } from "process";

interface ClipOptions {
  length?: number;
  hookLength?: number;
  promptType?: "business" | "viral";
  customPrompt?: string;
  textPrompt?: string;
  numberOfVideos?: number;
  customText?: string;
  textPosition?: "top" | "bottom" | "middle";
  textColor?: string;
  captions?: boolean;
  captionColor?: string;
  captionFont?: string;
}

const processClipsAsync = async (
  uploadedFilePath: string,
  clipIds: number[],
  teamId: number,
  userId: number,
  options: ClipOptions,
  originalFileName?: string,
  fileSize?: number
) => {
  try {
    console.log(`Starting clip processing for clips: ${clipIds.join(", ")}`);

    const transcriptionData = await transcribeVideoService(uploadedFilePath);
    if (!transcriptionData) throw new Error("Transcription failed");

    console.log("Transcription completed successfully");

    const clipOptions: ClipGenerationOptions = {
      length: options.length,
      hookLength: options.hookLength,
      promptType: options.promptType,
      customPrompt: options.customPrompt,
      textPrompt: options.textPrompt,
      numberOfVideos: options.numberOfVideos,
    };

    const clipSuggestionsArray = await generateClipSuggestionsService(
      transcriptionData,
      clipOptions
    );

    if (!clipSuggestionsArray || clipSuggestionsArray.length === 0) {
      throw new Error("Failed to generate clip suggestions");
    }

    const clipResults = await createMultipleCombinedClipsService(
      uploadedFilePath,
      clipSuggestionsArray,
      transcriptionData.results.channels[0].alternatives[0].words,
      {
        customText: options.customText,
        textPosition: options.textPosition,
        textColor: options.textColor,
        captions: options.captions,
        captionColor: options.captionColor,
        captionFont: options.captionFont,
      }
    );

    console.log("Created clip results:", clipResults.length);
    console.log("Extracting thumbnail from source video...");

    const thumbnailPath = await extractThumbnail(uploadedFilePath);
    const thumbnailS3Key = await s3Service.uploadThumbnail(
      thumbnailPath,
      teamId
    );

    console.log("Thumbnail uploaded to S3:", thumbnailS3Key);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    for (let i = 0; i < clipSuggestionsArray.length; i++) {
      const suggestions = clipSuggestionsArray[i];
      const result = clipResults[i];

      console.log(
        `Uploading clip ${i + 1}/${clipSuggestionsArray.length} to S3...`
      );

      const clipS3Key = await s3Service.uploadGeneratedClip(
        result.finalPath,
        teamId,
        clipIds[i]
      );

      const blankS3Key = await s3Service.uploadBlankClip(
        result.blankPath,
        teamId,
        clipIds[i]
      );

      const srtPath = `./output/captions_${clipIds[i]}.srt`;
      fs.writeFileSync(srtPath, result.srtContent);
      const srtS3Key = await s3Service.uploadSrtFile(srtPath, teamId, clipIds[i]);
      fs.unlinkSync(srtPath);

      console.log(`Clip uploaded to S3 with key: ${clipS3Key}`);

      await clipManagerService.updateClipComplete(clipIds[i], teamId, {
        clipPath: clipS3Key,
        blankVideoPath: blankS3Key,
        srtPath: srtS3Key,
        captionsData: result.captionsData,
        sourceVideoPath: thumbnailS3Key,
        title: suggestions.clipTitle,
        clipMetadata: {
          clipSuggestions: suggestions,
          parameters: {
            length: options.length || 40,
            hookLength: options.hookLength || 6,
            promptType: options.promptType || "business",
            customText: options.customText,
            textPosition: options.textPosition,
            textColor: options.textColor,
            captions: options.captions || false,
            captionColor: options.captionColor,
          },
        },
        inputMetadata: {
          originalFileName,
          fileSize,
        },
        prompt: options.textPrompt || options.customPrompt,
        message: suggestions.finalMessage,
        clipScore: suggestions.evalScore,
      });

      if (fs.existsSync(result.finalPath)) {
        fs.unlinkSync(result.finalPath);
      }
      if (fs.existsSync(result.blankPath)) {
        fs.unlinkSync(result.blankPath);
      }
      console.log(`Cleaned up local clip files for clip ${clipIds[i]}`);
    }

    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
      console.log(`Cleaned up uploaded file: ${uploadedFilePath}`);
    }

    console.log(`Successfully processed all ${clipIds.length} clips`);
    emitClipsRefresh(teamId);
  } catch (error) {
    console.error("Error processing clips:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    for (const clipId of clipIds) {
      await clipManagerService.updateClipStatus(
        clipId,
        teamId,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    emitClipsRefresh(teamId);

    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }
  }
};

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
    const captionFont = req.body.captionFont as string | undefined;

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

    processClipsAsync(
      uploadedFilePath,
      clipIds,
      teamId,
      userId,
      {
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
        captionFont,
      },
      req.file?.originalname,
      req.file?.size
    );

    res.json({
      clipIds,
      message: `Processing ${numberOfVideos} clip(s)`,
    });
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
