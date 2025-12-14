import { Request, Response } from "express";
import { clipManagerService } from "../services/clipManager.service";
import { s3Service } from "../services/s3.service";

export class ClipManagerController {
  async getClips(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const clips = await clipManagerService.getClipsByTeam(teamId);

      const s3Keys = clips
        .filter(clip => clip.clip_path)
        .map(clip => clip.clip_path!);

      const presignedUrls = await s3Service.getMultiplePresignedUrls(s3Keys);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get clips",
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

      let clipUrl = null;
      let sourceVideoUrl = null;

      if (clip.clip_path) {
        clipUrl = await s3Service.getPresignedUrl(clip.clip_path);
      }

      if (clip.source_video_path) {
        sourceVideoUrl = await s3Service.getPresignedUrl(clip.source_video_path);
      }

      return res.status(200).json({
        clip: {
          ...clip,
          clipUrl,
          sourceVideoUrl,
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

      const s3Keys = clips
        .filter(clip => clip.clip_path)
        .map(clip => clip.clip_path!);

      const presignedUrls = await s3Service.getMultiplePresignedUrls(s3Keys);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
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
}

export const clipManagerController = new ClipManagerController();
