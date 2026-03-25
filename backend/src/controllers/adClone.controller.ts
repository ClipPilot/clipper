import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { adCloneService } from "../services/ad-clone/adclone.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { db } from "../db";
import { clips, ugcVideoGenerationJobs } from "@clipper/shared-db";
import { eq, and, sql } from "drizzle-orm";
import { s3Service } from "../services/s3.service";
import { transcribeVideoService } from "../services/clips/transcription.service";
import { convertWordsToCaptionEntries, CaptionEntry } from "../services/clips/captions.service";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

export class AdCloneController {
  async initStructure(req: AuthRequest, res: Response) {
    try {
      const { projectId, message, productImageKeys, threadId, conversationHistory } = req.body;

      if (!projectId || !message) {
        return res.status(400).json({ error: "projectId and message are required" });
      }

      const result = await adCloneService.initStructureFromAnalysis({
        projectId,
        message,
        productImageKeys,
        threadId,
        conversationHistory,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[AD_CLONE] Init structure error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to generate structure"),
      });
    }
  }

  async createProject(req: AuthRequest, res: Response) {
    try {
      const { teamId, productName, productDescription, adDirection } = req.body;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const result = await adCloneService.createProject({
        teamId,
        userId: req.user.dbUserId,
        productImageKeys: [],
        productName,
        productDescription,
        adDirection,
      });

      return res.status(201).json({
        success: true,
        projectId: result.projectId,
        uploadUrls: result.uploadUrls,
      });
    } catch (error) {
      console.error("[AD_CLONE] Create project error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to create project"),
      });
    }
  }

  async getUploadUrls(req: AuthRequest, res: Response) {
    try {
      const { teamId, projectId, videoFileName, productImageFileNames } = req.body;

      if (!teamId || !projectId || !videoFileName) {
        return res.status(400).json({
          error: "teamId, projectId, and videoFileName are required",
        });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const uploadUrls = await s3Service.getAdCloneUploadUrls(
        teamId,
        projectId,
        videoFileName,
        productImageFileNames || []
      );

      return res.status(200).json({
        success: true,
        uploadUrls,
      });
    } catch (error) {
      console.error("[AD_CLONE] Get upload URLs error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get upload URLs"),
      });
    }
  }

  async confirmUpload(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { referenceVideoKey, productImageKeys } = req.body;

      if (!projectId || !referenceVideoKey) {
        return res.status(400).json({
          error: "projectId and referenceVideoKey are required",
        });
      }

      await adCloneService.setVideoUploaded(
        projectId,
        referenceVideoKey,
        productImageKeys || []
      );

      return res.status(200).json({
        success: true,
        message: "Upload confirmed",
      });
    } catch (error) {
      console.error("[AD_CLONE] Confirm upload error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to confirm upload"),
      });
    }
  }

  async startAnalysis(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId } = req.body;

      if (!projectId || !teamId) {
        return res.status(400).json({ error: "projectId and teamId are required" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const project = await adCloneService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (project.teamId !== teamId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!project.referenceVideoKey) {
        return res.status(400).json({ error: "Reference video not uploaded" });
      }

      await sqsService.sendAdCloneAnalyzeJob({
        projectId,
        teamId,
        userId: req.user.dbUserId,
      });

      return res.status(202).json({
        success: true,
        projectId,
        status: "analyzing",
        message: "Analysis started. Poll for status.",
      });
    } catch (error) {
      console.error("[AD_CLONE] Start analysis error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to start analysis"),
      });
    }
  }

  async updateScript(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { script, selectedVariantIndex } = req.body;

      if (!projectId || !script) {
        return res.status(400).json({ error: "projectId and script are required" });
      }

      await adCloneService.updateScript(projectId, script, selectedVariantIndex);

      return res.status(200).json({
        success: true,
        message: "Script updated",
      });
    } catch (error) {
      console.error("[AD_CLONE] Update script error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to update script"),
      });
    }
  }

  async linkVideoJob(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { videoJobId } = req.body;

      if (!projectId || !videoJobId) {
        return res.status(400).json({ error: "projectId and videoJobId are required" });
      }

      await adCloneService.setVideoJobId(projectId, videoJobId);

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[AD_CLONE] Link video job error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to link video job"),
      });
    }
  }

  async getStatus(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      let project = await adCloneService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check if video job has completed and update ad clone project accordingly
      if (project.videoJobId && project.status === "generating_video") {
        const [videoJob] = await db
          .select()
          .from(ugcVideoGenerationJobs)
          .where(eq(ugcVideoGenerationJobs.id, project.videoJobId))
          .limit(1);

        if (videoJob) {
          if (videoJob.status === "completed" && videoJob.final_video_key) {
            // Update ad clone project with the final video
            await adCloneService.setFinalVideo(projectId, videoJob.final_video_key);
            // Refresh project data
            project = await adCloneService.getProject(projectId);
          } else if (videoJob.status === "failed") {
            // Update ad clone project as failed
            await adCloneService.updateProjectStatus(
              projectId,
              "failed",
              0,
              "Video generation failed",
              videoJob.error_message || "Unknown error"
            );
            project = await adCloneService.getProject(projectId);
          } else if (videoJob.status === "generating" || videoJob.status === "queued") {
            // Update progress from video job
            project = {
              ...project,
              progress: videoJob.progress || 0,
              progressMessage: videoJob.progress_message || (videoJob.status === "queued" ? "Video generation queued..." : "Generating video..."),
            };
          }
        }
      }

      const response: any = {
        success: true,
        projectId: project!.id,
        status: project!.status,
        progress: project!.progress,
        progressMessage: project!.progressMessage,
        createdAt: project!.createdAt,
        updatedAt: project!.updatedAt,
      };

      if (project!.status === "analysis_complete" || project!.videoAnalysis) {
        response.hasAnalysis = true;
      }

      if (project!.status === "script_generated" || project!.adaptedScripts) {
        response.hasScript = true;
        if (project!.adaptedScripts) {
          response.script = project!.adaptedScripts[project!.selectedVariantIndex];
        }
      }

      if (project!.status === "completed" && project!.finalVideoKey) {
        response.finalVideoUrl = await s3Service.getPresignedUrl(
          project!.finalVideoKey,
          3600
        );

        // Check if already finalized to a clip
        const [existingClip] = await db
          .select({ id: clips.id })
          .from(clips)
          .where(
            and(
              eq(clips.team_id, project!.teamId),
              sql`${clips.clip_metadata}->>'projectId' = ${project!.id}`
            )
          )
          .limit(1);

        if (existingClip) {
          response.clipId = existingClip.id;
        }
      }

      if (project!.status === "failed") {
        response.error = project!.errorMessage;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[AD_CLONE] Get status error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get status"),
      });
    }
  }

  async getProject(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await adCloneService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const response: any = {
        success: true,
        project: {
          id: project.id,
          teamId: project.teamId,
          productName: project.productName,
          productDescription: project.productDescription,
          adDirection: project.adDirection,
          status: project.status,
          progress: project.progress,
          progressMessage: project.progressMessage,
          selectedVariantIndex: project.selectedVariantIndex,
          characterId: project.characterId,
          voiceId: project.voiceId,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      };

      if (project.referenceVideoKey) {
        response.project.referenceVideoUrl = await s3Service.getPresignedUrl(
          project.referenceVideoKey,
          3600
        );
      }

      if (project.productImageKeys.length > 0) {
        response.project.productImageUrls = await Promise.all(
          project.productImageKeys.map((key) =>
            s3Service.getPresignedUrl(key, 3600)
          )
        );
      }

      if (project.videoAnalysis) {
        response.analysis = project.videoAnalysis;
      }

      if (project.adaptedScripts) {
        response.scripts = project.adaptedScripts;
      }

      if (project.finalVideoKey) {
        response.project.finalVideoUrl = await s3Service.getPresignedUrl(
          project.finalVideoKey,
          3600
        );
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[AD_CLONE] Get project error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get project"),
      });
    }
  }

  async finalizeProject(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId, folderId } = req.body;

      if (!projectId || !teamId) {
        return res.status(400).json({ error: "projectId and teamId are required" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const project = await adCloneService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (project.teamId !== teamId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (project.status !== "completed" || !project.finalVideoKey) {
        return res.status(400).json({ error: "Project video not completed" });
      }

      // Check if already finalized — return existing clip instead of creating a duplicate
      const [existingClip] = await db
        .select({ id: clips.id })
        .from(clips)
        .where(
          and(
            eq(clips.team_id, teamId),
            sql`${clips.clip_metadata}->>'projectId' = ${projectId}`
          )
        )
        .limit(1);

      if (existingClip) {
        return res.status(200).json({
          success: true,
          clipId: existingClip.id,
        });
      }

      const selectedScript = project.adaptedScripts?.[project.selectedVariantIndex];

      let captionsData: CaptionEntry[] = [];
      const tempDir = path.join(process.cwd(), "output", "temp-transcribe");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempVideoPath = path.join(tempDir, `adclone_finalize_${projectId}_${Date.now()}.mp4`);

      try {
        console.log("[AD_CLONE] Downloading video for transcription...");
        await s3Service.downloadVideoFromUrl(
          await s3Service.getPresignedUrl(project.finalVideoKey, 300),
          tempVideoPath
        );

        console.log("[AD_CLONE] Transcribing video with Deepgram...");
        const transcription = await transcribeVideoService(tempVideoPath);

        const words = transcription?.results?.channels?.[0]?.alternatives?.[0]?.words || [];

        if (words.length > 0) {
          console.log(`[AD_CLONE] Got ${words.length} words from transcription`);
          captionsData = convertWordsToCaptionEntries(words, 4);
          console.log(`[AD_CLONE] Created ${captionsData.length} caption entries`);
        } else {
          console.log("[AD_CLONE] No words found in transcription");
        }
      } catch (transcribeError) {
        console.error("[AD_CLONE] Transcription failed, proceeding without captions:", transcribeError);
      } finally {
        if (fs.existsSync(tempVideoPath)) {
          fs.unlinkSync(tempVideoPath);
        }
      }

      const clipMetadata = {
        type: "ad-clone",
        projectId: project.id,
        scriptId: project.videoJobId,
        generationJobId: project.videoJobId,
        referenceVideoKey: project.referenceVideoKey,
        productName: project.productName,
        scenes: selectedScript?.scenes?.length || 0,
      };

      const [clip] = await db
        .insert(clips)
        .values({
          team_id: teamId,
          generated_by_user_id: req.user.dbUserId,
          folder_id: folderId || null,
          clip_path: project.finalVideoKey,
          blank_video_path: project.finalVideoKey,
          captions_data: captionsData.length > 0 ? captionsData : null,
          status: "completed",
          saved: true,
          clip_metadata: clipMetadata,
        })
        .returning();

      return res.status(200).json({
        success: true,
        clipId: clip.id,
      });
    } catch (error) {
      console.error("[AD_CLONE] Finalize project error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to finalize project"),
      });
    }
  }
}

export const adCloneController = new AdCloneController();
