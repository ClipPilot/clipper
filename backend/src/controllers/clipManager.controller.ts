import * as Sentry from "@sentry/node";
import { Request, Response } from "express";
import { clipManagerService } from "../services/clips/clipManager.service";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { tagService } from "../services/tag.service";
import { userService } from "../services/user.service";
import { AuthRequest } from "../middleware/auth.middleware";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { handleControllerError, verifyTeamAccessOrFail } from "../utils/controllerHelpers";
import { transcribeVideoService } from "../services/clips/transcription.service";
import { TranscriptionWord, CaptionEntry } from "../services/clips/captions.service";
import { ensureOutputDir, safeUnlink } from "../utils/fileUtils";
import { generateViralHeading } from "../services/clips/headingAI.service";
import path from "path";
import archiver from "archiver";
import { Readable } from "stream";


/**
 * Enriches a list of clips (with clip_path and source_video_path fields)
 * with presigned S3 URLs for both the clip and its source thumbnail.
 */
async function enrichClipsWithSignedUrls<
  T extends { clip_path?: string | null; source_video_path?: string | null }
>(clips: T[]): Promise<(T & { clipUrl: string | null; sourceVideoUrl: string | null })[]> {
  const clipKeys = clips
    .filter((clip) => clip.clip_path)
    .map((clip) => clip.clip_path!);

  const thumbnailKeys = clips
    .filter((clip) => clip.source_video_path)
    .map((clip) => clip.source_video_path!);

  const allKeys = [...new Set([...clipKeys, ...thumbnailKeys])];
  const presignedUrls = await s3Service.getMultiplePresignedUrls(allKeys);

  return clips.map((clip) => ({
    ...clip,
    clipUrl: clip.clip_path ? presignedUrls[clip.clip_path] : null,
    sourceVideoUrl: clip.source_video_path
      ? presignedUrls[clip.source_video_path]
      : null,
  }));
}

export class ClipManagerController {
  async getClips(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clips = await clipManagerService.getClipsByTeam(teamId);
      const clipsWithUrls = await enrichClipsWithSignedUrls(clips);

      return res.status(200).json({ clips: clipsWithUrls });
    } catch (error) {
      return handleControllerError(res, "Get clips error", error, "Failed to get clips");
    }
  }

  async getPendingClips(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Get pending clips error", error, "Failed to get pending clips");
    }
  }

  async getCompletedClips(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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

      const clipsWithUrls = await enrichClipsWithSignedUrls(clips);

      return res.status(200).json({
        clips: clipsWithUrls,
        pagination: {
          limit,
          offset,
          hasMore: clips.length === limit,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Get completed clips error", error, "Failed to get completed clips");
    }
  }

  async getClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Get clip error", error, "Clip not found", 404);
    }
  }

  async streamClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);

      // Use watermarked path for unsaved clips, clip_path for saved
      const videoPath = clip.saved
        ? clip.clip_path
        : clip.watermarked_clip_path;

      if (!videoPath) {
        return res.status(404).json({ error: "Video not available" });
      }

      const range = req.headers.range;
      const s3Response = await s3Service.getObject(videoPath, range || undefined);

      res.setHeader("Content-Type", s3Response.ContentType || "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

      if (range && s3Response.ContentRange) {
        res.status(206);
        res.setHeader("Content-Range", s3Response.ContentRange);
      }

      if (s3Response.ContentLength) {
        res.setHeader("Content-Length", s3Response.ContentLength.toString());
      }

      const stream = s3Response.Body as NodeJS.ReadableStream;
      stream.pipe(res);
    } catch (error) {
      return handleControllerError(res, "Stream clip error", error, "Failed to stream video");
    }
  }

  async updateClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { message, clipScore, folderId, title } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      // Check if moving clip to a folder requires Scale or Enterprise plan
      if (folderId !== undefined && folderId !== null) {
        const team = await teamService.getTeamById(teamId);
        if (team.plan !== "scale" && team.plan !== "enterprise") {
          return res.status(403).json({
            error:
              "Moving clips to folders requires a Scale or Enterprise plan. Please upgrade to organize clips into folders.",
          });
        }
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
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
      return handleControllerError(res, "Update clip error", error, "Failed to update clip", 404);
    }
  }

  async getClipsByFolder(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const folderId = parseInt(req.params.folderId);

      if (isNaN(teamId) || isNaN(folderId)) {
        return res.status(400).json({ error: "Invalid team ID or folder ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const campaignUploads = (req.query.campaignUploads as string) || "all";
      const clips = await clipManagerService.getClipsByFolder(teamId, folderId, campaignUploads as "all" | "only" | "hide");
      const clipsWithUrls = await enrichClipsWithSignedUrls(clips);

      const clipIds = clips.map((clip) => clip.id);
      const tagsByClip = await tagService.getTagsForClips(clipIds);

      const clipsWithUrlsAndTags = clipsWithUrls.map((clip) => ({
        ...clip,
        tags: tagsByClip[clip.id] || [],
      }));

      return res.status(200).json({ clips: clipsWithUrlsAndTags });
    } catch (error) {
      return handleControllerError(res, "Get clips by folder error", error, "Failed to get clips");
    }
  }

  async deleteClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (clip.status === "pending") {
        return res.status(409).json({
          error: "This clip is currently being processed. Please wait until processing is complete before deleting.",
        });
      }

      if (clip.clip_path) {
        await s3Service.deleteObject(clip.clip_path);
      }

      await clipManagerService.deleteClip(clipId, teamId);

      return res.status(200).json({
        message: "Clip deleted successfully",
      });
    } catch (error) {
      return handleControllerError(res, "Delete clip error", error, "Failed to delete clip", 404);
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

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Update captions error", error, "Failed to queue captions update");
    }
  }

  async generateCaptions(req: AuthRequest, res: Response) {
    const localPath: string[] = [];

    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (!clip.blank_video_path) {
        return res.status(400).json({ error: "No blank video available for this clip" });
      }

      // Download blank video to temp file
      const outDir = ensureOutputDir();
      const videoPath = path.join(outDir, `transcribe_${clipId}_${Date.now()}.mp4`);
      localPath.push(videoPath);

      console.log(`[generate-captions] Downloading blank video for clip ${clipId}`);
      await s3Service.downloadFile(clip.blank_video_path, videoPath);

      // Transcribe with Deepgram
      console.log(`[generate-captions] Transcribing clip ${clipId}...`);
      const transcription = await transcribeVideoService(videoPath);

      // Extract words with timing
      const words: TranscriptionWord[] =
        transcription?.results?.channels?.[0]?.alternatives?.[0]?.words?.map(
          (w: any) => ({
            start: w.start,
            end: w.end,
            punctuated_word: w.punctuated_word || w.word,
          })
        ) || [];

      if (words.length === 0) {
        return res.status(200).json({
          captionsData: [],
          message: "No speech detected in this video",
        });
      }

      // Group words into caption entries (4 words per segment)
      const WORDS_PER_GROUP = 4;
      const captionsData: CaptionEntry[] = [];
      for (let i = 0; i < words.length; i += WORDS_PER_GROUP) {
        const group = words.slice(i, i + WORDS_PER_GROUP);
        if (group.length === 0) continue;
        captionsData.push({
          index: captionsData.length + 1,
          startTime: group[0].start,
          endTime: group[group.length - 1].end,
          text: group.map((w) => w.punctuated_word || "").join(" "),
        });
      }

      // Update DB with generated captions
      await clipManagerService.updateClipCaptions(clipId, teamId, {
        captionsData,
      });

      console.log(`[generate-captions] Generated ${captionsData.length} caption segments for clip ${clipId}`);

      return res.status(200).json({ captionsData });
    } catch (error) {
      return handleControllerError(res, "Generate captions error", error, "Failed to generate captions");
    } finally {
      localPath.forEach(safeUnlink);
    }
  }

  async updateTextOverlay(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { text, color, font, x, y, fontSize, style } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
        style,
      });

      console.log(`Text overlay job sent to SQS with messageId: ${messageId}`);

      return res.status(200).json({
        message: "Text overlay queued for processing",
        jobId: messageId,
        clipId,
      });
    } catch (error) {
      return handleControllerError(res, "Update text overlay error", error, "Failed to queue text overlay");
    }
  }

  async generateHeading(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);

      // Build context from clip data — use captions for transcript,
      // fall back to clipSuggestions.finalMessage or clip title
      const metadata = clip.clip_metadata as any;
      const captionsData = clip.captions_data as Array<{ text: string }> | null;
      const transcription = captionsData?.map((c) => c.text).join(" ")
        || metadata?.clipSuggestions?.finalMessage
        || "";
      const title = metadata?.clipSuggestions?.clipTitle
        || metadata?.title
        || clip.prompt
        || "";

      const heading = await generateViralHeading({ transcription, title });

      return res.status(200).json({ heading });
    } catch (error) {
      return handleControllerError(res, "Generate heading error", error, "Failed to generate heading");
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

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Update overlays error", error, "Failed to queue overlays update");
    }
  }

  async saveClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Save clip error", error, "Failed to save clip");
    }
  }

  async getUnsavedClips(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Get unsaved clips error", error, "Failed to get unsaved clips");
    }
  }

  async getSavedClips(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : 0;

      if (limit > 100) {
        return res.status(400).json({ error: "Limit cannot exceed 100" });
      }

      const sort = req.query.sort === "oldest" ? "oldest" as const : "newest" as const;
      const campaignUploads = (req.query.campaignUploads as string) || "all";
      const clips = await clipManagerService.getSavedUnorganizedClips(
        teamId,
        limit,
        offset,
        sort,
        campaignUploads as "all" | "only" | "hide"
      );

      const clipsWithUrls = await enrichClipsWithSignedUrls(clips);

      const clipIds = clips.map((clip) => clip.id);
      const tagsByClip = await tagService.getTagsForClips(clipIds);

      const clipsWithUrlsAndTags = clipsWithUrls.map((clip) => ({
        ...clip,
        tags: tagsByClip[clip.id] || [],
      }));

      return res.status(200).json({
        clips: clipsWithUrlsAndTags,
        pagination: {
          limit,
          offset,
          hasMore: clips.length === limit,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Get saved clips error", error, "Failed to get saved clips");
    }
  }

  async rejectClip(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Reject clip error", error, "Failed to reject clip", 404);
    }
  }

  async generateShareLink(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

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
      return handleControllerError(res, "Generate share link error", error, "Failed to generate share link");
    }
  }

  async removeShareLink(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      await clipManagerService.removeShareToken(clipId, teamId);

      return res.status(200).json({
        message: "Share link removed successfully",
      });
    } catch (error) {
      return handleControllerError(res, "Remove share link error", error, "Failed to remove share link");
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
      return handleControllerError(res, "Get shared clip error", error, "Shared clip not found", 404);
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
      return handleControllerError(res, "Download shared clip error", error, "Shared clip not found", 404);
    }
  }
  async searchClips(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.query.teamId as string);
      if (isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      // Parse query parameters
      const query = req.query.q as string | undefined;
      const tagsParam = req.query.tags as string | undefined;
      const status = req.query.status as string | undefined;
      const folderIdParam = req.query.folderId as string | undefined;
      const dateFromParam = req.query.from as string | undefined;
      const dateToParam = req.query.to as string | undefined;
      const campaignUploadsParam = (req.query.campaignUploads as string) || "all";
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Parse tag IDs
      let tagIds: number[] | undefined;
      if (tagsParam) {
        tagIds = tagsParam.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
        if (tagIds.length === 0) tagIds = undefined;
      }

      // Parse folder ID (special case: "null" means unorganized clips)
      let folderId: number | null | undefined;
      if (folderIdParam !== undefined) {
        if (folderIdParam === "null" || folderIdParam === "") {
          folderId = null;
        } else {
          const parsedFolderId = parseInt(folderIdParam);
          if (!isNaN(parsedFolderId)) {
            folderId = parsedFolderId;
          }
        }
      }

      // Parse dates
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;
      if (dateFromParam) {
        dateFrom = new Date(dateFromParam);
        if (isNaN(dateFrom.getTime())) {
          return res.status(400).json({ error: "Invalid 'from' date format" });
        }
      }
      if (dateToParam) {
        dateTo = new Date(dateToParam);
        if (isNaN(dateTo.getTime())) {
          return res.status(400).json({ error: "Invalid 'to' date format" });
        }
        dateTo.setHours(23, 59, 59, 999);
      }

      // Validate status
      const validStatuses = ["pending", "completed", "failed", "rejected", "expired"];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      // Call service
      const result = await clipManagerService.searchClips({
        teamId,
        query,
        tagIds,
        status,
        folderId,
        dateFrom,
        dateTo,
        campaignUploads: campaignUploadsParam as "all" | "only" | "hide",
        limit,
        offset,
      });

      // Generate presigned URLs and fetch tags
      const clipsWithUrls = await enrichClipsWithSignedUrls(result.clips);

      const clipIds = result.clips.map((clip: any) => clip.id);
      const tagsByClip = clipIds.length > 0 ? await tagService.getTagsForClips(clipIds) : {};

      const clipsWithUrlsAndTags = clipsWithUrls.map((clip: any) => ({
        ...clip,
        tags: tagsByClip[clip.id] || [],
      }));

      return res.status(200).json({
        clips: clipsWithUrlsAndTags,
        pagination: result.pagination,
        query: query || null,
        filters: {
          tags: tagIds || null,
          status: status || null,
          folderId: folderId !== undefined ? folderId : null,
          dateFrom: dateFromParam || null,
          dateTo: dateToParam || null,
        },
      });
    } catch (error) {
      return handleControllerError(res, "Search clips error", error, "Failed to search clips");
    }
  }

  /**
   * Submit a video edit job (CapCut-like editing)
   */
  async submitVideoEdit(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { editConfig } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      if (!editConfig) {
        return res.status(400).json({ error: "editConfig is required" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);

      if (!clip.saved) {
        return res.status(403).json({ error: "Cannot edit unsaved clips" });
      }

      if (!clip.blank_video_path) {
        return res
          .status(400)
          .json({ error: "No blank video available for this clip" });
      }

      // Validate editConfig structure
      const { segments, trim, crop, speed, audio, captions, heading } = editConfig;

      // Validate segments (new per-segment editing)
      if (segments) {
        if (!Array.isArray(segments)) {
          return res.status(400).json({ error: "Segments must be an array" });
        }
        if (segments.length === 0) {
          return res.status(400).json({ error: "Segments array cannot be empty" });
        }
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (typeof seg.startTime !== "number" || typeof seg.endTime !== "number") {
            return res.status(400).json({ error: `Invalid segment ${i}: startTime and endTime must be numbers` });
          }
          if (seg.startTime >= seg.endTime) {
            return res.status(400).json({ error: `Invalid segment ${i}: startTime must be before endTime` });
          }
          if (typeof seg.speed !== "number" || seg.speed < 0.25 || seg.speed > 4) {
            return res.status(400).json({ error: `Invalid segment ${i}: speed must be between 0.25 and 4` });
          }
        }
      }

      // Validate trim (legacy - only if segments not provided)
      if (trim && !segments) {
        if (typeof trim.startTime !== "number" || typeof trim.endTime !== "number") {
          return res.status(400).json({ error: "Invalid trim configuration" });
        }
        if (trim.startTime >= trim.endTime) {
          return res.status(400).json({ error: "Trim start must be before end" });
        }
      }

      // Validate speed (legacy - only if segments not provided)
      if (speed !== undefined && !segments) {
        if (typeof speed !== "number" || speed < 0.25 || speed > 4) {
          return res.status(400).json({ error: "Speed must be between 0.25 and 4" });
        }
      }

      // Validate crop
      if (crop) {
        const validRatios = ["9:16", "16:9", "1:1", "4:5", "custom"];
        if (!validRatios.includes(crop.aspectRatio)) {
          return res.status(400).json({ error: "Invalid aspect ratio" });
        }
      }

      // Validate audio
      if (audio) {
        if (typeof audio.originalVolume !== "number" || audio.originalVolume < 0 || audio.originalVolume > 1) {
          return res.status(400).json({ error: "Volume must be between 0 and 1" });
        }
      }

      // Set clip status to pending
      await clipManagerService.updateClipStatus(clipId, teamId, "pending");

      const userId = req.user?.dbUserId || 0;
      const messageId = await sqsService.sendVideoEditJob({
        clipId,
        teamId,
        userId,
        editConfig,
      });

      console.log(`Video edit job sent to SQS with messageId: ${messageId}`);

      return res.status(200).json({
        message: "Video edit queued for processing",
        jobId: messageId,
        clipId,
      });
    } catch (error) {
      return handleControllerError(res, "Submit video edit error", error, "Failed to queue video edit");
    }
  }

  /**
   * Get presigned URL for music upload
   */
  async getMusicUploadUrl(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { fileName, contentType, fileSize } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      if (!fileName || !contentType) {
        return res.status(400).json({ error: "fileName and contentType are required" });
      }

      // Validate file type
      const validTypes = ["audio/mpeg", "audio/wav", "audio/aac", "audio/mp4"];
      if (!validTypes.includes(contentType)) {
        return res.status(400).json({ error: "Invalid audio format. Use MP3, WAV, or AAC" });
      }

      // Validate file size (50MB max)
      if (fileSize && fileSize > 50 * 1024 * 1024) {
        return res.status(400).json({ error: "File size must be less than 50MB" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);
      if (!clip.saved) {
        return res.status(403).json({ error: "Cannot add music to unsaved clips" });
      }

      // Generate S3 key for music file
      const timestamp = Date.now();
      const extension = fileName.split(".").pop() || "mp3";
      const s3Key = `teams/${teamId}/clips/${clipId}/music/${timestamp}.${extension}`;

      // Get presigned URL for upload
      const uploadUrl = await s3Service.getPresignedUploadUrlForKey(s3Key, contentType);

      return res.status(200).json({
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      return handleControllerError(res, "Get music upload URL error", error, "Failed to get upload URL");
    }
  }
  async getOverlayUploadUrl(req: AuthRequest, res: Response) {
    try {
      const clipId = parseInt(req.params.clipId);
      const teamId = parseInt(req.params.teamId);
      const { fileName, contentType } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      if (!fileName || !contentType) {
        return res.status(400).json({ error: "fileName and contentType are required" });
      }

      // Validate file type (images + videos)
      const validTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "video/mp4", "video/quicktime", "video/webm",
      ];
      if (!validTypes.includes(contentType)) {
        return res.status(400).json({ error: "Invalid file type. Use JPEG, PNG, GIF, WebP, MP4, MOV, or WebM" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clip = await clipManagerService.getClipById(clipId, teamId);
      if (!clip.saved) {
        return res.status(403).json({ error: "Cannot add overlays to unsaved clips" });
      }

      // Generate S3 key for overlay file
      const timestamp = Date.now();
      const extension = fileName.split(".").pop() || "bin";
      const s3Key = `teams/${teamId}/clips/${clipId}/overlays/${timestamp}.${extension}`;

      const uploadUrl = await s3Service.getPresignedUploadUrlForKey(s3Key, contentType);

      return res.status(200).json({ uploadUrl, s3Key });
    } catch (error) {
      return handleControllerError(res, "Get overlay upload URL error", error, "Failed to get upload URL");
    }
  }
  /**
   * Get presigned view URLs for saved overlay S3 keys
   */
  async getOverlayViewUrls(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const clipId = parseInt(req.params.clipId);
      const { s3Keys } = req.body;

      if (isNaN(clipId) || isNaN(teamId)) {
        return res.status(400).json({ error: "Invalid clip ID or team ID" });
      }

      if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
        return res.status(400).json({ error: "s3Keys array is required" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const allowedPrefixes = [
        `teams/${teamId}/clips/${clipId}/overlays/`,
        `teams/${teamId}/clips/${clipId}/music/`,
        `uploads/${teamId}/`,
        `raw-videos/${teamId}/`,
      ];
      for (const key of s3Keys) {
        if (!allowedPrefixes.some(p => key.startsWith(p))) {
          return res.status(403).json({ error: "Invalid S3 key for this clip" });
        }
      }

      const urlMap = await s3Service.getMultiplePresignedUrls(s3Keys);

      return res.status(200).json({ urls: urlMap });
    } catch (error) {
      return handleControllerError(res, "Get overlay view URLs error", error, "Failed to get overlay URLs");
    }
  }

  async downloadFolderAsZip(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const folderId = parseInt(req.params.folderId);

      if (isNaN(teamId) || isNaN(folderId)) {
        return res.status(400).json({ error: "Invalid team ID or folder ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clips = await clipManagerService.getClipsByFolder(teamId, folderId);
      const completedClips = clips.filter(
        (clip) => clip.status === "completed" && clip.clip_path,
      );

      if (completedClips.length === 0) {
        return res.status(404).json({ error: "No completed clips in this folder" });
      }

      const archive = archiver("zip", { zlib: { level: 0 } });

      const folderName = `clips-folder-${folderId}`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${folderName}.zip"`,
      );

      archive.on("error", (err) => {
        Sentry.captureException(err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create archive" });
        }
      });

      archive.pipe(res);

      const BATCH_SIZE = 20;
      for (let i = 0; i < completedClips.length; i += BATCH_SIZE) {
        const batch = completedClips.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (clip) => {
            const s3Response = await s3Service.getObject(clip.clip_path!);
            const filename = `${clip.title || `clip_${clip.id}`}.mp4`.replace(
              /[^a-zA-Z0-9._-]/g,
              "_",
            );
            return { stream: s3Response.Body as unknown as Readable, filename };
          }),
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            archive.append(result.value.stream, { name: result.value.filename });
          }
        }
      }

      await archive.finalize();
    } catch (error) {
      if (!res.headersSent) {
        return handleControllerError(res, "Download folder as ZIP error", error, "Failed to download folder");
      }
    }
  }

  async downloadFolderUrls(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.params.teamId);
      const folderId = parseInt(req.params.folderId);

      if (isNaN(teamId) || isNaN(folderId)) {
        return res.status(400).json({ error: "Invalid team ID or folder ID" });
      }

      const user = await verifyTeamAccessOrFail(req, teamId, res);
      if (!user) return;

      const clips = await clipManagerService.getClipsByFolder(teamId, folderId);
      const completedClips = clips.filter(
        (clip) => clip.status === "completed" && clip.clip_path,
      );

      if (completedClips.length === 0) {
        return res.status(404).json({ error: "No completed clips in this folder" });
      }

      const urls = await Promise.all(
        completedClips.map(async (clip) => {
          const filename = `${clip.title || `clip_${clip.id}`}.mp4`.replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
          );
          const url = await s3Service.getPresignedDownloadUrl(
            clip.clip_path!,
            filename,
            3600,
          );
          return { url, filename };
        }),
      );

      res.json({ urls, folderName: `clips-folder-${folderId}` });
    } catch (error) {
      return handleControllerError(res, "Download folder URLs error", error, "Failed to get download URLs");
    }
  }
}

export const clipManagerController = new ClipManagerController();
