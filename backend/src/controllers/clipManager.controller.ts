import { Request, Response } from "express";
import { clipManagerService } from "../services/clipManager.service";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { tagService } from "../services/tag.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { getTeamUsage } from "../middleware/subscription.middleware";

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

      // Block access to unsaved clips
      if (!clip.saved) {
        return res.status(403).json({ error: "Access denied" });
      }

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

      const tags = await tagService.getTagsForClip(clipId);

      return res.status(200).json({
        clip: {
          ...clip,
          clipUrl,
          sourceVideoUrl,
          blankVideoUrl,
          tags,
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
      const tags = await tagService.getTagsForClip(clipId);

      return res.status(200).json({
        message: "Clip updated successfully",
        clip: { ...updatedClip, tags },
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

      const clipIds = clips.map(clip => clip.id);
      const tagsByClip = await tagService.getTagsForClips(clipIds);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path ? presignedUrls[clip.source_video_path] : null,
        tags: tagsByClip[clip.id] || [],
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

  async updateCaptions(req: AuthRequest, res: Response) {
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

      if (!clip.saved) {
        return res.status(403).json({ error: "Cannot edit unsaved clips" });
      }

      if (!clip.blank_video_path) {
        return res.status(400).json({ error: "No blank video available for this clip" });
      }

      // Mark clip as processing
      await clipManagerService.updateClipStatus(clipId, teamId, "pending");

      // Send job to SQS for async processing
      const userId = req.user?.dbUserId || 0;
      const messageId = await sqsService.sendUpdateCaptionsJob({
        clipId,
        teamId,
        userId,
        captionsData,
        captionColor,
      });

      console.log(`Captions update job sent to SQS with messageId: ${messageId}`);

      return res.status(200).json({
        message: "Captions update queued for processing",
        jobId: messageId,
        clipId,
      });
    } catch (error) {
      console.error("Update captions error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to queue captions update",
      });
    }
  }

  async updateTextOverlay(req: AuthRequest, res: Response) {
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

      if (!clip.saved) {
        return res.status(403).json({ error: "Cannot edit unsaved clips" });
      }

      if (!clip.blank_video_path) {
        return res.status(400).json({ error: "No blank video available for this clip" });
      }

      await clipManagerService.updateClipStatus(clipId, teamId, "pending");

      const userId = req.user?.dbUserId || 0;
      const messageId = await sqsService.sendTextOverlayJob({
        clipId,
        teamId,
        userId,
        text,
        color,
        x,
        y,
        fontSize,
      });

      console.log(`Text overlay job sent to SQS with messageId: ${messageId}`);

      return res.status(200).json({
        message: "Text overlay queued for processing",
        jobId: messageId,
        clipId,
      });
    } catch (error) {
      console.error("Update text overlay error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to queue text overlay",
      });
    }
  }

  async saveClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (clip.saved) {
        return res.status(400).json({ error: "Clip is already saved" });
      }

      if (clip.status !== "completed") {
        return res.status(400).json({ error: "Can only save completed clips" });
      }

      const usage = await getTeamUsage(teamId);
      if (!usage) {
        return res.status(404).json({ error: "Team or usage stats not found" });
      }

      if (usage.remaining <= 0) {
        return res.status(403).json({
          error: "Clip limit reached",
          code: "CLIP_LIMIT_REACHED",
          usage: {
            clipsCreated: usage.clipsCreated,
            limit: usage.limit,
            remaining: 0,
            resetsDate: usage.resetsDate,
            plan: usage.plan,
          },
        });
      }

      await clipManagerService.saveClip(clipId, teamId);
      await teamService.incrementTeamUsage(teamId, 1);

      const updatedUsage = await getTeamUsage(teamId);

      let clipUrl: string | null = null;
      if (clip.clip_path) {
        clipUrl = await s3Service.getPresignedUrl(clip.clip_path);
      }

      return res.status(200).json({
        message: "Clip saved successfully",
        clip: {
          ...clip,
          saved: true,
          clipUrl,
        },
        usage: updatedUsage,
      });
    } catch (error) {
      console.error("Save clip error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to save clip",
      });
    }
  }

  async getUnsavedClips(req: Request, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const clips = await clipManagerService.getUnsavedClipsByTeam(teamId);

      const watermarkedKeys = clips
        .filter(clip => clip.watermarked_clip_path)
        .map(clip => clip.watermarked_clip_path!);

      const thumbnailKeys = clips
        .filter(clip => clip.source_video_path)
        .map(clip => clip.source_video_path!);

      const allKeys = [...new Set([...watermarkedKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.watermarked_clip_path ? presignedUrls[clip.watermarked_clip_path] : null,
        sourceVideoUrl: clip.source_video_path ? presignedUrls[clip.source_video_path] : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get unsaved clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get unsaved clips",
      });
    }
  }

  async getSavedClips(req: Request, res: Response) {
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

      const clips = await clipManagerService.getSavedUnorganizedClips(teamId, limit, offset);

      const clipKeys = clips
        .filter(clip => clip.clip_path)
        .map(clip => clip.clip_path!);

      const thumbnailKeys = clips
        .filter(clip => clip.source_video_path)
        .map(clip => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipIds = clips.map(clip => clip.id);
      const tagsByClip = await tagService.getTagsForClips(clipIds);

      const clipsWithUrls = clips.map(clip => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path ? presignedUrls[clip.source_video_path] : null,
        tags: tagsByClip[clip.id] || [],
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
      console.error("Get saved clips error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get saved clips",
      });
    }
  }
}

export const clipManagerController = new ClipManagerController();
