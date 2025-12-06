import { Request, Response } from "express";
import { ENV } from "../config/env";
import { transcribeVideoService } from "../services/transcription.service";
import { generateClipSuggestionsService } from "../services/aiSuggestions.service";
import { createCombinedClipService } from "../services/clip.service";

export const clipVideoController = async (req: Request, res: Response) => {
  try {
    const localVideo = ENV.LOCAL_VIDEO_PATH; 

    if (!localVideo) return res.status(400).json({ error: "No video uploaded" });

    const transcriptionData = await transcribeVideoService(localVideo);

    if (!transcriptionData) {
      return res.status(500).json({ error: "Transcription failed" });
    }

    const clipSuggestions = await generateClipSuggestionsService(transcriptionData);

    if (!clipSuggestions) {
      return res.status(500).json({ error: "Failed to generate clip suggestions" });
    }

    const combinedClipPath = await createCombinedClipService(localVideo, JSON.parse(clipSuggestions));
    res.json({ clipPath: combinedClipPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to transcribe" });
  }
};
