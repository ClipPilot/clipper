import { Request, Response } from "express";
import { clipManagerService } from "../services/clipManager.service";
import { s3Service } from "../services/s3.service";
import { regenerateClipWithCaptions, regenerateClipWithTextOverlay } from "../services/clip.service";
import fs from "fs";
import path from "path";

export class ClipManagerController {
  async getClips(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const clips = await clipManagerService.getClipsByTeam(teamId);

      const clipKeys = clips
        .filter(clip => clip.clip_path)
        .map(clip => clip.clip_path!);

      const thumbnailKeys = clips
        .filter(clip => clip.source_video_path)
        .map(clip => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path ? presignedUrls[clip.source_video_path] : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get clips",
      });
    }
  }

  async getPendingClips(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const clips = await clipManagerService.getPendingClipsByTeam(teamId);

      return res.status(200).json({ clips });
    } catch (error) {
      console.error("Get pending clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get pending clips",
      });
    }
  }

  async getCompletedClips(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      if (limit > 100) {
        return res.status(400).json({ error: "Limit cannot exceed 100" });
      }

      const clips = await clipManagerService.getCompletedClipsByTeam(teamId, limit, offset);

      const clipKeys = clips
        .filter(clip => clip.clip_path)
        .map(clip => clip.clip_path!);

      const thumbnailKeys = clips
        .filter(clip => clip.source_video_path)
        .map(clip => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path ? presignedUrls[clip.source_video_path] : null,
      }));

      return res.status(200).json({
        clips: clipsWithUrls,
        pagination: {
          limit,
          offset,
          hasMore: clips.length === limit,
        },
      });
    } catch (error) {
      console.error("Get completed clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get completed clips",
      });
    }
  }

  async getClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      let clipUrl: string | null = null;
      let sourceVideoUrl: string | null = null;
      let blankVideoUrl: string | null = null;

      if (clip.clip_path) {
        clipUrl = await s3Service.getPresignedUrl(clip.clip_path);
      }

      if (clip.source_video_path) {
        sourceVideoUrl = await s3Service.getPresignedUrl(clip.source_video_path);
      }

      if (clip.blank_video_path) {
        blankVideoUrl = await s3Service.getPresignedUrl(clip.blank_video_path);
      }

      return res.status(200).json({
        clip: {
          ...clip,
          clipUrl,
          sourceVideoUrl,
          blankVideoUrl,
        },
      });
    } catch (error) {
      console.error("Get clip error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Clip not found",
      });
    }
  }

  async updateClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { message, clipScore, folderId } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const updates: any = {};
      if (message !== undefined) updates.message = message;
      if (clipScore !== undefined) updates.clipScore = clipScore;
      if (folderId !== undefined) updates.folderId = folderId;

      const updatedClip = await clipManagerService.updateClip(clipId, teamId, updates);

      return res.status(200).json({
        message: "Clip updated successfully",
        clip: updatedClip,
      });
    } catch (error) {
      console.error("Update clip error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to update clip",
      });
    }
  }

  async getClipsByFolder(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const folderId = parseInt(req.params.folderId);

      if (isNaN(teamId) || isNaN(folderId)) {
        return res.status(400).json({ error: "Invalid team ID or folder ID" });
      }

      const clips = await clipManagerService.getClipsByFolder(teamId, folderId);

      const clipKeys = clips
        .filter(clip => clip.clip_path)
        .map(clip => clip.clip_path!);

      const thumbnailKeys = clips
        .filter(clip => clip.source_video_path)
        .map(clip => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path ? presignedUrls[clip.source_video_path] : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get clips by folder error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get clips",
      });
    }
  }

  async deleteClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (clip.clip_path) {
        await s3Service.deleteObject(clip.clip_path);
      }

      await clipManagerService.deleteClip(clipId, teamId);

      return res.status(200).json({
        message: "Clip deleted successfully",
      });
    } catch (error) {
      console.error("Delete clip error:", error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to delete clip",
      });
    }
  }

  async updateCaptions(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { captionsData, captionColor } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      if (!captionsData || !Array.isArray(captionsData)) {
        return res.status(400).json({ error: "Invalid captions data" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (!clip.blank_video_path) {
        return res.status(400).json({ error: "No blank video available for this clip" });
      }

      const outDir = path.join(process.cwd(), "output");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

      const localBlankPath = path.join(outDir, `blank_${clipId}_${Date.now()}.mp4`);
      await s3Service.downloadFile(clip.blank_video_path, localBlankPath);

      const metadata = clip.clip_metadata as any;
      const color = captionColor || metadata?.parameters?.captionColor || "#FFD600";

      const newClipPath = await regenerateClipWithCaptions(localBlankPath, captionsData, color);

      if (clip.clip_path) {
        await s3Service.deleteObject(clip.clip_path);
      }

      const newClipS3Key = await s3Service.uploadGeneratedClip(newClipPath, teamId, clipId);

      await clipManagerService.updateClipCaptions(clipId, teamId, {
        clipPath: newClipS3Key,
        captionsData,
      });

      if (fs.existsSync(localBlankPath)) fs.unlinkSync(localBlankPath);
      if (fs.existsSync(newClipPath)) fs.unlinkSync(newClipPath);

      const newClipUrl = await s3Service.getPresignedUrl(newClipS3Key);

      return res.status(200).json({
        message: "Captions updated successfully",
        clipUrl: newClipUrl,
        captionsData,
      });
    } catch (error) {
      console.error("Update captions error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update captions",
      });
    }
  }

  async updateTextOverlay(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { text, color, x, y, fontSize } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (!clip.blank_video_path) {
        return res.status(400).json({ error: "No blank video available for this clip" });
      }

      const outDir = path.join(process.cwd(), "output");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

      const localBlankPath = path.join(outDir, `blank_${clipId}_${Date.now()}.mp4`);
      await s3Service.downloadFile(clip.blank_video_path, localBlankPath);

      const newClipPath = await regenerateClipWithTextOverlay(localBlankPath, {
        text,
        color: color || "#FFFFFF",
        x: x ?? 50,
        y: y ?? 10,
        fontSize: fontSize ?? 48,
      });

      if (clip.clip_path) {
        await s3Service.deleteObject(clip.clip_path);
      }

      const newClipS3Key = await s3Service.uploadGeneratedClip(newClipPath, teamId, clipId);

      await clipManagerService.updateClip(clipId, teamId, { clipPath: newClipS3Key });

      if (fs.existsSync(localBlankPath)) fs.unlinkSync(localBlankPath);
      if (fs.existsSync(newClipPath)) fs.unlinkSync(newClipPath);

      const newClipUrl = await s3Service.getPresignedUrl(newClipS3Key);

      return res.status(200).json({
        message: "Text overlay applied successfully",
        clipUrl: newClipUrl,
      });
    } catch (error) {
      console.error("Update text overlay error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to apply text overlay",
      });
    }
  }
}

export const clipManagerController = new ClipManagerController();
