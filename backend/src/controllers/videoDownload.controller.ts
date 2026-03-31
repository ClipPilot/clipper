import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { videoDownloadService } from "../services/videoDownload.service";
import { s3Service } from "../services/s3.service";
import { handleControllerError, requireUser } from "../utils/controllerHelpers";

export const getVideoInfo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const info = await videoDownloadService.getVideoInfo(url);
    return res.json(info);
  } catch (err: any) {
    return handleControllerError(res, "Get video info error", err, "Failed to get video info", 400);
  }
};

export const downloadVideo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

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
      const result = await videoDownloadService.downloadToS3(
        url,
        parsedTeamId,
        (progress) => {
          sendProgress({
            type: "progress",
            percent: progress.percent,
            speed: progress.speed,
            eta: progress.eta,
          });
        }
      );

      sendProgress({
        type: "uploading",
        message: "Uploading to cloud...",
      });

      const downloadUrl = await s3Service.getPresignedUrl(result.s3Key, 3600);

      sendProgress({
        type: "complete",
        s3Key: result.s3Key,
        fileName: result.fileName,
        fileSize: result.fileSize,
        downloadUrl,
      });
    } catch (downloadErr: any) {
      sendProgress({
        type: "error",
        error: downloadErr.message || "Download failed",
      });
    }

    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      return handleControllerError(res, "Download video error", err, "Failed to download video");
    }
  }
};

export const downloadVideoSync = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { url, teamId } = req.body;

    if (!url || !teamId) {
      return res.status(400).json({ error: "URL and teamId are required" });
    }

    const parsedTeamId = parseInt(teamId);
    if (isNaN(parsedTeamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const result = await videoDownloadService.downloadToS3(url, parsedTeamId);
    const downloadUrl = await s3Service.getPresignedUrl(result.s3Key, 3600);

    return res.json({
      s3Key: result.s3Key,
      fileName: result.fileName,
      fileSize: result.fileSize,
      downloadUrl,
    });
  } catch (err: any) {
    return handleControllerError(res, "Download video error", err, "Failed to download video");
  }
};
