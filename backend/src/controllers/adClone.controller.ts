import { Request, Response } from "express";
import { adCloneService } from "../services/ad-clone/adclone.service";
import { sqsService, GenerateUGCVideoJob } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { db } from "../db";
import { adCloneProjects, ugcScripts, sceneImages, characters } from "@clipper/shared-db";
import { eq } from "drizzle-orm";
import { s3Service } from "../services/s3.service";
import { getTeamUsage } from "../middleware/subscription.middleware";

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
        error: error instanceof Error ? error.message : "Failed to create project",
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
        error: error instanceof Error ? error.message : "Failed to get upload URLs",
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
        error: error instanceof Error ? error.message : "Failed to confirm upload",
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
        error: error instanceof Error ? error.message : "Failed to start analysis",
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
        error: error instanceof Error ? error.message : "Failed to get analysis",
      });
    }
  }

  async generateScript(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId, characterId } = req.body;

      if (!projectId || !teamId || !characterId) {
        return res.status(400).json({
          error: "projectId, teamId, and characterId are required",
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
        characterId,
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
        error: error instanceof Error ? error.message : "Failed to generate script",
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
        error: error instanceof Error ? error.message : "Failed to update script",
      });
    }
  }

  async generateVideo(req: AuthRequest, res: Response) {
    try {
      const { projectId } = req.params;
      const { teamId, voiceId } = req.body;

      if (!projectId || !teamId || !voiceId) {
        return res.status(400).json({
          error: "projectId, teamId, and voiceId are required",
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

      // Calculate credit cost (2 credits per scene)
      const CREDIT_PER_SCENE = 2;
      const sceneCount = selectedScript.scenes.length;
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

      // Build scenes array for video generation
      const scenes: GenerateUGCVideoJob["scenes"] = selectedScript.scenes.map((scene: any) => {
        // Use character image for a-roll, product image for b-roll
        const imageKey = scene.shotType === "b-roll" && productImage
          ? productImage
          : primaryCharacterImage;

        const sceneData: GenerateUGCVideoJob["scenes"][number] = {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          shotType: scene.shotType,
          imageKey,
          dialogue: scene.dialogue,
          duration: scene.estimatedDurationSeconds || 5,
          cinematicPrompt: scene.cinematicPrompt || scene.action,
          action: scene.action,
          emotion: scene.emotion,
          ambientSound: scene.ambientSound || null,
        };

        // Handle b-roll shots (montage)
        if (scene.bRollShots && scene.bRollShots.length > 0 && scene.shotType === "b-roll") {
          sceneData.bRollShots = scene.bRollShots.map((shot: any) => ({
            action: shot.action,
            cinematicPrompt: shot.cinematicPrompt,
            durationSeconds: shot.durationSeconds,
            imageKey: shot.productImageNeeded && productImage ? productImage : primaryCharacterImage,
          }));
        }

        return sceneData;
      });

      console.log(`[AD_CLONE] Building video job with ${scenes.length} scenes`);

      // Increment usage
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

      await sqsService.sendGenerateUGCVideoJob({
        jobId: scriptRecord.id,
        teamId,
        userId: req.user.dbUserId,
        scriptId: scriptRecord.id,
        voiceId,
        scenes,
      });

      await adCloneService.setVideoJobId(projectId, scriptRecord.id);

      return res.status(202).json({
        success: true,
        projectId,
        videoJobId: scriptRecord.id,
        status: "generating_video",
        message: "Video generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[AD_CLONE] Generate video error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate video",
      });
    }
  }

  async getStatus(req: AuthRequest, res: Response) {
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
        projectId: project.id,
        status: project.status,
        progress: project.progress,
        progressMessage: project.progressMessage,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };

      if (project.status === "analysis_complete" || project.videoAnalysis) {
        response.hasAnalysis = true;
      }

      if (project.status === "script_generated" || project.adaptedScripts) {
        response.hasScript = true;
        if (project.adaptedScripts) {
          response.script = project.adaptedScripts[project.selectedVariantIndex];
        }
      }

      if (project.status === "completed" && project.finalVideoKey) {
        response.finalVideoUrl = await s3Service.getPresignedUrl(
          project.finalVideoKey,
          3600
        );
      }

      if (project.status === "failed") {
        response.error = project.errorMessage;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[AD_CLONE] Get status error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get status",
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
        error: error instanceof Error ? error.message : "Failed to get project",
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
        error: error instanceof Error ? error.message : "Failed to delete project",
      });
    }
  }
}

export const adCloneController = new AdCloneController();
