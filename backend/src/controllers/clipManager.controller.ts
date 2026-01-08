import * as Sentry from "@sentry/node";
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
        .filter((clip) => clip.clip_path)
        .map((clip) => clip.clip_path!);

      const thumbnailKeys = clips
        .filter((clip) => clip.source_video_path)
        .map((clip) => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipsWithUrls = clips.map((clip) => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path
          ? presignedUrls[clip.source_video_path]
          : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get clips error:", error);
      Sentry.captureException(error);
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

      // Generate signed URLs for raw videos
      const rawVideoKeys = clips
        .filter((clip: any) => clip.raw_video_path)
        .map((clip: any) => clip.raw_video_path!);

      const uniqueKeys = [...new Set(rawVideoKeys)];
      const presignedUrls =
        await s3Service.getMultiplePresignedUrls(uniqueKeys);

      const clipsWithUrls = clips.map((clip: any) => ({
        ...clip,
        rawVideoUrl: clip.raw_video_path
          ? presignedUrls[clip.raw_video_path]
          : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get pending clips error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get pending clips",
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
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      if (limit > 100) {
        return res.status(400).json({ error: "Limit cannot exceed 100" });
      }

      const clips = await clipManagerService.getCompletedClipsByTeam(
        teamId,
        limit,
        offset
      );

      const clipKeys = clips
        .filter((clip) => clip.clip_path)
        .map((clip) => clip.clip_path!);

      const thumbnailKeys = clips
        .filter((clip) => clip.source_video_path)
        .map((clip) => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipsWithUrls = clips.map((clip) => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path
          ? presignedUrls[clip.source_video_path]
          : null,
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
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get completed clips",
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
        sourceVideoUrl = await s3Service.getPresignedUrl(
          clip.source_video_path
        );
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
      Sentry.captureException(error);
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

      // Check if moving clip to a folder requires Scale plan
      if (folderId !== undefined && folderId !== null) {
        const team = await teamService.getTeamById(teamId);
        if (team.plan !== "scale") {
          return res.status(403).json({
            error:
              "Moving clips to folders requires a Scale plan. Please upgrade to organize clips into folders.",
          });
        }
      }

      const updates: any = {};
      if (message !== undefined) updates.message = message;
      if (clipScore !== undefined) updates.clipScore = clipScore;
      if (folderId !== undefined) updates.folderId = folderId;

      const updatedClip = await clipManagerService.updateClip(
        clipId,
        teamId,
        updates
      );
      const tags = await tagService.getTagsForClip(clipId);

      return res.status(200).json({
        message: "Clip updated successfully",
        clip: { ...updatedClip, tags },
      });
    } catch (error) {
      console.error("Update clip error:", error);
      Sentry.captureException(error);
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
        .filter((clip) => clip.clip_path)
        .map((clip) => clip.clip_path!);

      const thumbnailKeys = clips
        .filter((clip) => clip.source_video_path)
        .map((clip) => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipIds = clips.map((clip) => clip.id);
      const tagsByClip = await tagService.getTagsForClips(clipIds);

      const clipsWithUrls = clips.map((clip) => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path
          ? presignedUrls[clip.source_video_path]
          : null,
        tags: tagsByClip[clip.id] || [],
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get clips by folder error:", error);
      Sentry.captureException(error);
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
      Sentry.captureException(error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to delete clip",
      });
    }
  }

  async updateCaptions(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { captionsData, captionColor, captionFont, captionsEnabled } =
        req.body;

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
        return res
          .status(400)
          .json({ error: "No blank video available for this clip" });
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
        captionFont,
        captionsEnabled: captionsEnabled !== false, // default to true
      });

      console.log(
        `Captions update job sent to SQS with messageId: ${messageId}`
      );

      return res.status(200).json({
        message: "Captions update queued for processing",
        jobId: messageId,
        clipId,
      });
    } catch (error) {
      console.error("Update captions error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue captions update",
      });
    }
  }

  async updateTextOverlay(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { text, color, font, x, y, fontSize } = req.body;

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
        return res
          .status(400)
          .json({ error: "No blank video available for this clip" });
      }

      await clipManagerService.updateClipStatus(clipId, teamId, "pending");

      const userId = req.user?.dbUserId || 0;
      const messageId = await sqsService.sendTextOverlayJob({
        clipId,
        teamId,
        userId,
        text,
        color,
        font,
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
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue text overlay",
      });
    }
  }

  async updateClipOverlays(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const {
        captionsEnabled,
        captionsData,
        captionColor,
        captionFont,
        heading,
      } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (!clip.saved) {
        return res.status(403).json({ error: "Cannot edit unsaved clips" });
      }

      if (!clip.blank_video_path) {
        return res
          .status(400)
          .json({ error: "No blank video available for this clip" });
      }

      await clipManagerService.updateClipStatus(clipId, teamId, "pending");

      const userId = req.user?.dbUserId || 0;
      const messageId = await sqsService.sendUpdateOverlaysJob({
        clipId,
        teamId,
        userId,
        captionsEnabled: captionsEnabled ?? true,
        captionsData,
        captionColor,
        captionFont,
        heading,
      });

      console.log(
        `Update overlays job sent to SQS with messageId: ${messageId}`
      );

      return res.status(200).json({
        message: "Overlays update queued for processing",
        jobId: messageId,
        clipId,
      });
    } catch (error) {
      console.error("Update overlays error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue overlays update",
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
            baseLimit: usage.baseLimit,
            baseRemaining: usage.baseRemaining,
            addonRemaining: usage.addonRemaining,
            totalRemaining: usage.totalRemaining,
            resetsDate: usage.resetsDate,
            plan: usage.plan,
            // Legacy
            limit: usage.limit,
            remaining: 0,
          },
        });
      }

      await clipManagerService.saveClip(clipId, teamId);

      // Consume clip from base plan first, then addon
      const consumeResult = await teamService.consumeClip(teamId);
      if (!consumeResult.success) {
        return res.status(403).json({
          error: "Failed to consume clip quota",
          code: "CLIP_CONSUME_FAILED",
        });
      }

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
      Sentry.captureException(error);
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
        .filter((clip) => clip.watermarked_clip_path)
        .map((clip) => clip.watermarked_clip_path!);

      const thumbnailKeys = clips
        .filter((clip) => clip.source_video_path)
        .map((clip) => clip.source_video_path!);

      const SHORT_EXPIRY = 300; // 5 minutes
      const watermarkedUrls = await s3Service.getMultiplePresignedUrls(
        watermarkedKeys,
        SHORT_EXPIRY
      );
      const thumbnailUrls = await s3Service.getMultiplePresignedUrls(
        thumbnailKeys,
        SHORT_EXPIRY
      );

      const clipsWithUrls = clips.map((clip) => ({
        ...clip,
        clipUrl: clip.watermarked_clip_path
          ? watermarkedUrls[clip.watermarked_clip_path]
          : null,
        sourceVideoUrl: clip.source_video_path
          ? thumbnailUrls[clip.source_video_path]
          : null,
      }));

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      console.error("Get unsaved clips error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get unsaved clips",
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
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      if (limit > 100) {
        return res.status(400).json({ error: "Limit cannot exceed 100" });
      }

      const clips = await clipManagerService.getSavedUnorganizedClips(
        teamId,
        limit,
        offset
      );

      const clipKeys = clips
        .filter((clip) => clip.clip_path)
        .map((clip) => clip.clip_path!);

      const thumbnailKeys = clips
        .filter((clip) => clip.source_video_path)
        .map((clip) => clip.source_video_path!);

      const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
      const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

      const clipIds = clips.map((clip) => clip.id);
      const tagsByClip = await tagService.getTagsForClips(clipIds);

      const clipsWithUrls = clips.map((clip) => ({
        ...clip,
        clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
        sourceVideoUrl: clip.source_video_path
          ? presignedUrls[clip.source_video_path]
          : null,
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
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to get saved clips",
      });
    }
  }

  async rejectClip(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (clip.saved) {
        return res.status(400).json({ error: "Cannot reject a saved clip" });
      }

      if (clip.status === "rejected") {
        return res.status(400).json({ error: "Clip is already rejected" });
      }

      await clipManagerService.rejectClip(clipId, teamId);

      return res.status(200).json({
        message: "Clip rejected successfully",
      });
    } catch (error) {
      console.error("Reject clip error:", error);
      Sentry.captureException(error);
      return res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to reject clip",
      });
    }
  }

  async generateShareLink(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (!clip.saved) {
        return res.status(400).json({ error: "Can only share saved clips" });
      }

      const updatedClip = await clipManagerService.generateShareToken(
        clipId,
        teamId
      );

      return res.status(200).json({
        message: "Share link generated successfully",
        shareToken: updatedClip.share_token,
      });
    } catch (error) {
      console.error("Generate share link error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate share link",
      });
    }
  }

  async removeShareLink(req: Request, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      await clipManagerService.removeShareToken(clipId, teamId);

      return res.status(200).json({
        message: "Share link removed successfully",
      });
    } catch (error) {
      console.error("Remove share link error:", error);
      Sentry.captureException(error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove share link",
      });
    }
  }

  async getSharedClip(req: Request, res: Response) {
    try {
      const { shareToken } = req.params;

      if (!shareToken) {
        return res.status(400).json({ error: "Share token is required" });
      }

      const clip = await clipManagerService.getClipByShareToken(shareToken);

      let clipUrl: string | null = null;
      if (clip.clip_path) {
        clipUrl = await s3Service.getPresignedUrl(clip.clip_path);
      }

      return res.status(200).json({
        clip: {
          id: clip.id,
          title: clip.title,
          message: clip.message,
          clipUrl,
          created_at: clip.created_at,
        },
      });
    } catch (error) {
      console.error("Get shared clip error:", error);
      Sentry.captureException(error);
      return res.status(404).json({
        error: "Shared clip not found",
      });
    }
  }

  async downloadSharedClip(req: Request, res: Response) {
    try {
      const { shareToken } = req.params;

      if (!shareToken) {
        return res.status(400).json({ error: "Share token is required" });
      }

      const clip = await clipManagerService.getClipByShareToken(shareToken);

      if (!clip.clip_path) {
        return res.status(404).json({ error: "Clip file not found" });
      }

      const filename = `${clip.title || `clip_${clip.id}`}.mp4`.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );
      const downloadUrl = await s3Service.getPresignedDownloadUrl(
        clip.clip_path,
        filename
      );

      return res.status(200).json({ downloadUrl });
    } catch (error) {
      console.error("Download shared clip error:", error);
      Sentry.captureException(error);
      return res.status(404).json({
        error: "Shared clip not found",
      });
    }
  }
}

export const clipManagerController = new ClipManagerController();
