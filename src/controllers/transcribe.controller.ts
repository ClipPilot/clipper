import { Request, Response } from "express";
import { transcribeVideoService } from "../services/transcribe.service";

export const transcribeVideoController = async (req: Request, res: Response) => {
  try {
    const localVideo = "/Users/mmnagelia/Downloads/test.mp4"; 

    if (!localVideo) return res.status(400).json({ error: "No video uploaded" });

    const data = await transcribeVideoService(localVideo);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to transcribe" });
  }
};
