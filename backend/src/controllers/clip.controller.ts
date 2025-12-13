import { Request, Response } from "express";
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

export const clipVideoController = async (req: AuthRequest, res: Response) => {
  let uploadedFilePath: string | undefined;

  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    uploadedFilePath = req.file.path;

    // Get teamId from request
    const teamId = req.body.teamId ? parseInt(req.body.teamId) : null;
    if (!teamId) {
      return res.status(400).json({ error: "Team ID is required" });
    }

    // Check usage limits
    try {
      const usageStats = await teamService.getTeamUsageStats(teamId);
      const remaining = usageStats.limit - usageStats.clips_created;

      if (remaining <= 0) {
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
    } catch (error) {
      console.error("Error checking usage:", error);
      return res.status(500).json({ error: "Failed to check usage limits" });
    }

    // Parse parameters from request body
    const length = req.body.length ? parseInt(req.body.length) : undefined;
    const hookLength = req.body.hookLength
      ? parseInt(req.body.hookLength)
      : undefined;
    const promptType = req.body.promptType as "business" | "viral" | undefined;
    const customPrompt = req.body.customPrompt as string | undefined;
    const textPrompt = req.body.textPrompt as string | undefined;
    const numberOfVideos = req.body.numberOfVideos
      ? parseInt(req.body.numberOfVideos)
      : undefined;
    const customText = req.body.customText as string | undefined;
    const textPosition = req.body.textPosition as "top" | "bottom" | undefined;

    // Validate parameters
    if (length && (length < 10 || length > 120)) {
      return res.status(400).json({
        error: "Length must be between 10 and 120 seconds",
      });
    }

    if (hookLength && (hookLength < 2 || hookLength > 15)) {
      return res.status(400).json({
        error: "Hook length must be between 2 and 15 seconds",
      });
    }

    if (promptType && !["business", "viral"].includes(promptType)) {
      return res.status(400).json({
        error: 'Prompt type must be either "business" or "viral"',
      });
    }

    if (textPosition && !["top", "middle", "bottom"].includes(textPosition)) {
      return res.status(400).json({
        error: 'Text position must be "top", "middle", or "bottom"',
      });
    }

    if (numberOfVideos && (numberOfVideos < 1 || numberOfVideos > 5)) {
      return res.status(400).json({
        error: "Number of videos must be between 1 and 5",
      });
    }

    console.log("Transcribing video...");
    const transcriptionData = await transcribeVideoService(uploadedFilePath);

    if (!transcriptionData) {
      return res.status(500).json({ error: "Transcription failed" });
    }

    console.log("Generating clip suggestions...");
    const options: ClipGenerationOptions = {
      length,
      hookLength,
      promptType,
      customPrompt,
      textPrompt,
      numberOfVideos,
    };

    const clipSuggestionsArray = await generateClipSuggestionsService(
      transcriptionData,
      options
    );

    if (!clipSuggestionsArray || clipSuggestionsArray.length === 0) {
      return res
        .status(500)
        .json({ error: "Failed to generate clip suggestions" });
    }

    console.log(`Creating ${clipSuggestionsArray.length} combined clip(s)...`);
    const combinedClipPaths = await createMultipleCombinedClipsService(
      uploadedFilePath,
      clipSuggestionsArray,
      {
        customText,
        textPosition,
      }
    );

    // Clean up uploaded file
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    // Save clips to database and update usage
    const savedClips: any[] = [];
    const userId = req.user!.dbUserId;

    for (let i = 0; i < clipSuggestionsArray.length; i++) {
      const suggestions = clipSuggestionsArray[i];
      const clipPath = combinedClipPaths[i];

      const savedClip = await clipManagerService.createClip({
        teamId,
        userId,
        clipPath,
        sourceVideoPath: uploadedFilePath,
        clipMetadata: {
          clipSuggestions: suggestions,
          parameters: {
            length: options.length || 40,
            hookLength: options.hookLength || 6,
            promptType: options.promptType || "business",
            customText,
            textPosition,
          },
        },
        inputMetadata: {
          originalFileName: req.file?.originalname,
          fileSize: req.file?.size,
        },
        prompt: textPrompt || customPrompt,
        message: suggestions.finalMessage,
        clipScore: suggestions.evalScore,
      });

      savedClips.push(savedClip);
    }

    // Update usage stats - increment by number of clips created
    await teamService.incrementTeamUsage(teamId, clipSuggestionsArray.length);

    // Build response with multiple videos
    const videos = savedClips.map((clip: any, index: number) => ({
      id: clip.id,
      clipPath: combinedClipPaths[index],
      clipSuggestions: clipSuggestionsArray[index],
      finalMessage: clipSuggestionsArray[index].finalMessage,
      evalScore: clipSuggestionsArray[index].evalScore,
    }));

    res.json({
      videos,
      parameters: {
        length: options.length || 40,
        hookLength: options.hookLength || 6,
        promptType: options.promptType || "business",
        numberOfVideos: options.numberOfVideos || 1,
      },
      message: `Successfully created ${videos.length} clip(s)`,
    });
  } catch (err) {
    console.error("Error in clipVideoController:", err);

    // Clean up uploaded file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to process video",
    });
  }
};
