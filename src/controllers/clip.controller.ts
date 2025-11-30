import { Request, Response } from "express";
import { generateClipSuggestionsService, transcribeVideoService } from "../services/clip.service";
import { ENV } from "../config/env";

export const clipVideoController = async (req: Request, res: Response) => {
  try {
    const localVideo = ENV.LOCAL_VIDEO_PATH; 

    if (!localVideo) return res.status(400).json({ error: "No video uploaded" });

    const data = await transcribeVideoService(localVideo);
    const clipSuggestions = await generateClipSuggestionsService(data);
    res.json(clipSuggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to transcribe" });
  }
};
