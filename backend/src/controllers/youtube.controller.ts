import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { youtubeService } from "../services/youtube.service";

export const getVideoInfo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "YouTube URL is required" });
    }

    const info = await youtubeService.getVideoInfo(url);
    return res.json(info);
  } catch (err: any) {
    console.error("Get video info error:", err);
    return res.status(400).json({ error: err.message || "Failed to get video info" });
  }
};

export const downloadVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { url, teamId } = req.body;

    if (!url || !teamId) {
      return res.status(400).json({ error: "URL and teamId are required" });
    }

    const parsedTeamId = parseInt(teamId);
    if (isNaN(parsedTeamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendProgress = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendProgress({ type: "start", message: "Starting download..." });

    try {
      const result = await youtubeService.downloadAndUploadToS3(
        url,
        parsedTeamId,
        (progress) => {
          sendProgress({
            type: "progress",
            percent: progress.percent,
            speed: progress.speed,
            eta: progress.eta,
            downloaded: progress.downloaded,
            total: progress.total,
          });
        }
      );

      sendProgress({
        type: "uploading",
        message: "Uploading to cloud...",
      });

      sendProgress({
        type: "complete",
        s3Key: result.s3Key,
        fileName: result.fileName,
        fileSize: result.fileSize,
      });
    } catch (downloadErr: any) {
      sendProgress({
        type: "error",
        error: downloadErr.message || "Download failed",
      });
    }

    res.end();
  } catch (err: any) {
    console.error("Download video error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Failed to download video" });
    }
  }
};

export const downloadVideoSync = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { url, teamId } = req.body;

    if (!url || !teamId) {
      return res.status(400).json({ error: "URL and teamId are required" });
    }

    const parsedTeamId = parseInt(teamId);
    if (isNaN(parsedTeamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const result = await youtubeService.downloadAndUploadToS3(url, parsedTeamId);

    return res.json({
      s3Key: result.s3Key,
      fileName: result.fileName,
      fileSize: result.fileSize,
    });
  } catch (err: any) {
    console.error("Download video error:", err);
    return res.status(500).json({ error: err.message || "Failed to download video" });
  }
};
