import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { adCloneService } from "../services/ad-clone/adclone.service";
import { sqsService, GenerateUGCVideoJob } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { db } from "../db";
import { adCloneProjects, ugcScripts, sceneImages, characters, clips, ugcVideoGenerationJobs } from "@clipper/shared-db";
import { eq, and, sql } from "drizzle-orm";
import { s3Service } from "../services/s3.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { transcribeVideoService } from "../services/clips/transcription.service";
import { convertWordsToCaptionEntries, CaptionEntry } from "../services/clips/captions.service";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";
import { ugcScriptService } from "../services/ai-ugc/ugcScript.service";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

export class AdCloneController {
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

  async startAnalyzeAndScript(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId, characterId, voiceId } = req.body;

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

      if (characterId) {
        await adCloneService.updateCharacterId(projectId, characterId);
      }
      if (voiceId) {
        await adCloneService.updateVoiceId(projectId, voiceId);
      }

      await sqsService.sendAdCloneAnalyzeAndScriptJob({
        projectId,
        teamId,
        userId: req.user.dbUserId,
      });

      return res.status(202).json({
        success: true,
        projectId,
        status: "analyzing",
        message: "Analysis and script generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[AD_CLONE] Start analyze and script error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to start processing"),
      });
    }
  }

  async getAnalysis(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await adCloneService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      return res.status(200).json({
        success: true,
        projectId: project.id,
        status: project.status,
        analysis: project.videoAnalysis,
      });
    } catch (error) {
      console.error("[AD_CLONE] Get analysis error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get analysis"),
      });
    }
  }

  async generateScript(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId, characterId } = req.body;

      if (!projectId || !teamId) {
        return res.status(400).json({
          error: "projectId and teamId are required",
        });
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

      if (!project.videoAnalysis) {
        return res.status(400).json({ error: "Video analysis not complete" });
      }

      await sqsService.sendAdCloneGenerateScriptJob({
        projectId,
        teamId,
        userId: req.user.dbUserId,
        characterId: characterId || undefined,
      });

      return res.status(202).json({
        success: true,
        projectId,
        status: "generating_script",
        message: "Script generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[AD_CLONE] Generate script error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to generate script"),
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

  async regenerateBRollPrompt(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { sceneId, bRollShotIndex, newAction } = req.body;

      if (!projectId || !sceneId || bRollShotIndex === undefined || !newAction) {
        return res.status(400).json({
          error: "projectId, sceneId, bRollShotIndex, and newAction are required",
        });
      }

      await adCloneService.regenerateBRollPrompt({
        projectId,
        sceneId,
        bRollShotIndex,
        newAction,
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[AD_CLONE] Regenerate B-roll prompt error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to regenerate B-roll prompt"),
      });
    }
  }

  async regenerateAllBRollShots(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { sceneId, newSceneAction, shotCount, shotDurations } = req.body;

      if (!projectId || !sceneId || !newSceneAction || !shotCount || !shotDurations) {
        return res.status(400).json({
          error: "projectId, sceneId, newSceneAction, shotCount, and shotDurations are required",
        });
      }

      const newShots = await adCloneService.regenerateAllBRollShots({
        projectId,
        sceneId,
        newSceneAction,
        shotCount,
        shotDurations,
      });

      return res.status(200).json({ success: true, bRollShots: newShots });
    } catch (error) {
      console.error("[AD_CLONE] Regenerate all B-roll shots error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to regenerate B-roll shots"),
      });
    }
  }

  async generateVideo(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId, voiceId, characterId } = req.body;

      if (!projectId || !teamId || !voiceId || !characterId) {
        return res.status(400).json({
          error: "projectId, teamId, voiceId, and characterId are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Save characterId to project before validation
      await adCloneService.updateCharacterId(projectId, characterId);

      const project = await adCloneService.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (project.teamId !== teamId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!project.adaptedScripts || project.adaptedScripts.length === 0) {
        return res.status(400).json({ error: "Script not generated" });
      }

      if (!project.characterId) {
        return res.status(400).json({ error: "Character not selected" });
      }

      const selectedScript = project.adaptedScripts[project.selectedVariantIndex] as any;

      if (!selectedScript?.scenes?.length) {
        return res.status(400).json({ error: "No scenes found in the selected script" });
      }

      // Get the character to use their primary image for a-roll scenes
      const [character] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, project.characterId));

      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const characterImages = character.character_images as string[];
      const primaryCharacterImage = characterImages[character.primary_image_index || 0];

      if (!primaryCharacterImage) {
        return res.status(400).json({ error: "Character has no portrait image" });
      }

      // Use the first product image for b-roll scenes
      const productImage = project.productImageKeys[0];

      // Calculate credit cost (2 credits per original scene, merged a-rolls count individually)
      const CREDIT_PER_SCENE = 2;
      const sceneCount = selectedScript.scenes.reduce((count: number, scene: any) => {
        return count + (scene.mergedSceneTypes?.length || 1);
      }, 0);
      const creditCost = sceneCount * CREDIT_PER_SCENE;

      const usage = await getTeamUsage(teamId);
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }
      if (usage.totalRemaining < creditCost) {
        return res.status(403).json({
          error: `Insufficient credits. This video (${sceneCount} scenes) requires ${creditCost} credits, but you have ${usage.totalRemaining} remaining.`,
          code: "INSUFFICIENT_CREDITS",
          required: creditCost,
          available: usage.totalRemaining,
        });
      }

      await Promise.all(
        (selectedScript.scenes as any[]).map(async (scene: any) => {
          const promises: Promise<void>[] = [
            ugcScriptService.regenerateCinematicPrompt(scene.action)
              .then((p: string) => { scene.cinematicPrompt = p; }),
          ];
          for (const shot of scene.bRollShots || []) {
            promises.push(
              ugcScriptService.regenerateCinematicPrompt(shot.action)
                .then((p: string) => { shot.cinematicPrompt = p; })
            );
          }
          await Promise.all(promises);
        })
      );

      await adCloneService.updateScript(projectId, selectedScript, project.selectedVariantIndex);

      const savedImages = await db
        .select()
        .from(sceneImages)
        .where(eq(sceneImages.script_id, projectId));

      const scenes: GenerateUGCVideoJob["scenes"] = [];

      for (const scene of selectedScript.scenes as any[]) {
        const savedImage = savedImages.find((img) => img.scene_id === scene.id);

        if (!savedImage) {
          return res.status(400).json({
            error: `No image found for scene ${scene.sceneNumber}. Please generate storyboard images first.`,
          });
        }

        const cinematicPrompt = scene.cinematicPrompt || `${scene.action}. ${scene.emotion} expression. ${scene.shotType === "a-roll" ? "Person speaks naturally to camera." : "Product shot with smooth motion."}`;

        const sceneData: GenerateUGCVideoJob["scenes"][number] = {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          shotType: scene.shotType,
          imageKey: savedImage.image_key,
          dialogue: scene.dialogue,
          duration: scene.estimatedDurationSeconds || 5,
          cinematicPrompt,
          action: scene.action,
          emotion: scene.emotion,
          ambientSound: scene.ambientSound,
        };

        if (scene.bRollShots && scene.bRollShots.length > 0 && scene.shotType === "b-roll") {
          const baseKey = savedImage.image_key;

          sceneData.bRollShots = scene.bRollShots.map((shot: any, index: number) => {
            const shotImageKey = baseKey.replace(/variant_\d+/, `variant_${index}`);
            const shotCinematicPrompt = shot.cinematicPrompt || `${shot.action}. Product shot with smooth camera motion.`;
            return {
              action: shot.action,
              cinematicPrompt: shotCinematicPrompt,
              durationSeconds: shot.durationSeconds,
              imageKey: shotImageKey,
            };
          });
        }

        scenes.push(sceneData);
      }

      await teamService.incrementTeamUsage(teamId, creditCost);

      const [scriptRecord] = await db
        .insert(ugcScripts)
        .values({
          team_id: teamId,
          character_id: project.characterId,
          product_image_keys: project.productImageKeys,
          product_name: project.productName || null,
          script_direction: project.adDirection || null,
          scripts_data: [selectedScript],
          selected_variant_index: 0,
          status: "completed",
        })
        .returning();

      const [job] = await db
        .insert(ugcVideoGenerationJobs)
        .values({
          team_id: teamId,
          user_id: req.user.dbUserId,
          script_id: scriptRecord.id,
          voice_id: voiceId,
          status: "queued",
          progress: 0,
          progress_message: "Queued for video generation...",
        })
        .returning();

      const baseSpeed = project.videoAnalysis?.recommendedTTSSpeed || 1.0;
      const audioSpeedup = project.videoAnalysis?.estimatedAudioSpeedMultiplier || 1.0;
      const finalTTSSpeed = Math.min(baseSpeed * audioSpeedup, 2.0);

      await sqsService.sendGenerateUGCVideoJob({
        jobId: job.id,
        teamId,
        userId: req.user.dbUserId,
        scriptId: scriptRecord.id,
        voiceId,
        scenes,
        ttsSpeed: finalTTSSpeed,
      });

      await adCloneService.setVideoJobId(projectId, job.id);

      return res.status(202).json({
        success: true,
        projectId,
        videoJobId: job.id,
        status: "generating_video",
      });
    } catch (error) {
      console.error("[AD_CLONE] Generate video error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to generate video"),
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

  async deleteProject(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      await adCloneService.deleteProject(projectId);

      return res.status(200).json({
        success: true,
        message: "Project deleted",
      });
    } catch (error) {
      console.error("[AD_CLONE] Delete project error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to delete project"),
      });
    }
  }

  async listProjects(req: AuthRequest, res: Response) {
    try {
      const { teamId } = req.query;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      const team = await teamService.getTeamById(Number(teamId));
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const { projects, total } = await adCloneService.listProjects(
        Number(teamId),
        limit,
        offset
      );

      const projectsWithUrls = await Promise.all(
        projects.map(async (project) => {
          const result: any = {
            id: project.id,
            productName: project.productName,
            status: project.status,
            progress: project.progress,
            progressMessage: project.progressMessage,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          };

          if (project.productImageKeys.length > 0) {
            result.thumbnailUrl = await s3Service.getPresignedUrl(
              project.productImageKeys[0],
              3600
            );
          }

          if (project.finalVideoKey) {
            result.finalVideoUrl = await s3Service.getPresignedUrl(
              project.finalVideoKey,
              3600
            );
          }

          return result;
        })
      );

      return res.status(200).json({
        success: true,
        projects: projectsWithUrls,
        total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("[AD_CLONE] List projects error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to list projects"),
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
