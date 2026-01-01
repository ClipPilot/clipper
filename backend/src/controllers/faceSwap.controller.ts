import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { faceSwapService } from "../services/faceSwap.service";
import fs from "fs";

/**
 * Trim a video to the specified time range
 * Accepts a video file upload via multipart form data
 * Only uploads the trimmed result to S3
 */
export const trimVideo = async (req: AuthRequest, res: Response) => {
  const uploadedFile = req.file;

  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!uploadedFile) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const { startTime, endTime, teamId } = req.body;

    // Validate required fields
    if (startTime === undefined || endTime === undefined || !teamId) {
      return res.status(400).json({
        error: "Missing required fields: startTime, endTime, and teamId are required",
      });
    }

    // Validate time range
    const start = parseFloat(startTime);
    const end = parseFloat(endTime);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "startTime and endTime must be valid numbers" });
    }

    if (start < 0) {
      return res.status(400).json({ error: "startTime cannot be negative" });
    }

    if (end <= start) {
      return res.status(400).json({ error: "endTime must be greater than startTime" });
    }

    const duration = end - start;
    if (duration > 30) {
      return res.status(400).json({ error: "Maximum clip duration is 30 seconds" });
    }

    if (duration < 1) {
      return res.status(400).json({ error: "Minimum clip duration is 1 second" });
    }

    console.log(`[FACE-SWAP] Processing trim: ${uploadedFile.originalname}, ${start}s to ${end}s`);

    // Trim the video and upload only the trimmed result to S3
    const result = await faceSwapService.trimAndUpload({
      inputPath: uploadedFile.path,
      startTime: start,
      endTime: end,
      teamId: parseInt(teamId),
    });

    return res.status(200).json({
      success: true,
      trimmedVideoKey: result.trimmedVideoKey,
      trimmedVideoUrl: result.trimmedVideoUrl,
      duration: result.duration,
    });
  } catch (error) {
    console.error("[FACE-SWAP] Trim video error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to trim video",
    });
  } finally {
    // Cleanup uploaded file
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try {
        fs.unlinkSync(uploadedFile.path);
        console.log(`[FACE-SWAP] Cleaned up uploaded file: ${uploadedFile.path}`);
      } catch (cleanupError) {
        console.error("[FACE-SWAP] Failed to cleanup uploaded file:", cleanupError);
      }
    }
  }
};

export const faceSwapController = {
  trimVideo,
};
