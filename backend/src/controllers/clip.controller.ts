import { Request, Response } from "express";
import fs from "fs";
import { transcribeVideoService } from "../services/transcription.service";
import {
  generateClipSuggestionsService,
  ClipGenerationOptions,
} from "../services/aiSuggestions.service";
import { createMultipleCombinedClipsService } from "../services/clip.service";

export const clipVideoController = async (req: Request, res: Response) => {
  let uploadedFilePath: string | undefined;

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    uploadedFilePath = req.file.path;

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

    if (textPosition && !["top", "bottom"].includes(textPosition)) {
      return res.status(400).json({
        error: 'Text position must be either "top" or "bottom"',
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

    // Build response with multiple videos
    const videos = clipSuggestionsArray.map((suggestions, index) => ({
      clipPath: combinedClipPaths[index],
      clipSuggestions: suggestions,
      finalMessage: suggestions.finalMessage,
      evalScore: suggestions.evalScore,
    }));

    res.json({
      videos,
      parameters: {
        length: options.length || 40,
        hookLength: options.hookLength || 6,
        promptType: options.promptType || "business",
        numberOfVideos: options.numberOfVideos || 1,
      },
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
