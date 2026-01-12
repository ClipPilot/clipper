import { Request, Response } from "express";
import { db } from "../db";
import {
  sceneImageGenerationJobs,
  sceneImages,
  ugcScripts,
  characters,
} from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { eq, and } from "drizzle-orm";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

interface SceneData {
  id: string;
  sceneNumber: number;
  sceneType: string;
  action: string;
  dialogue: string;
  emotion: string;
  shotType: string;
  cameraAngle: string;
  cinematicPrompt: string;
}

export class SceneBuilderController {
  /**
   * Generate images for a single scene
   */
  async generateSceneImages(req: AuthRequest, res: Response) {
    try {
      const {
        teamId,
        scriptId,
        sceneId,
        sceneNumber,
        characterId,
        userRefinement,
        supportingImageKeys,
      } = req.body;

      if (!teamId || !scriptId || !sceneId || sceneNumber === undefined || !characterId) {
        return res.status(400).json({
          error: "teamId, scriptId, sceneId, sceneNumber, and characterId are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      // Fetch the script to get scene data and character
      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, scriptId));

      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }

      // Get the scene data from the selected variant
      const scriptsData = script.scripts_data as any[];
      const selectedScript = scriptsData[script.selected_variant_index];
      const sceneData = selectedScript?.scenes?.find(
        (s: SceneData) => s.id === sceneId
      ) as SceneData | undefined;

      if (!sceneData) {
        return res.status(404).json({ error: "Scene not found in script" });
      }

      // Build the prompt using cinematicPrompt from OpenAI
      const prompt = this.buildScenePrompt(sceneData, userRefinement);

      // Create the job record
      const [job] = await db
        .insert(sceneImageGenerationJobs)
        .values({
          team_id: teamId,
          user_id: req.user.dbUserId,
          script_id: scriptId,
          scene_id: sceneId,
          scene_number: sceneNumber,
          character_id: characterId,
          prompt,
          user_refinement: userRefinement || null,
          supporting_image_keys: supportingImageKeys || [],
          status: "queued",
          progress: 0,
          progress_message: "Queued for generation...",
        })
        .returning();

      // Send to SQS
      await sqsService.sendGenerateSceneImageJob({
        jobId: job.id,
        teamId,
        userId: req.user.dbUserId,
        scriptId,
        sceneId,
        sceneNumber,
        characterId,
        sceneData: {
          sceneType: sceneData.sceneType,
          action: sceneData.action,
          dialogue: sceneData.dialogue,
          emotion: sceneData.emotion,
          shotType: sceneData.shotType,
          cameraAngle: sceneData.cameraAngle,
          cinematicPrompt: sceneData.cinematicPrompt,
        },
        productImageKeys: script.product_image_keys as string[],
        userRefinement: userRefinement || undefined,
        supportingImageKeys: supportingImageKeys || [],
      });

      return res.status(202).json({
        success: true,
        jobId: job.id,
        status: "queued",
        message: "Scene image generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Generate scene images error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to queue generation",
      });
    }
  }

  /**
   * Generate images for all scenes in a script (batch)
   */
  async generateAllSceneImages(req: AuthRequest, res: Response) {
    try {
      const { teamId, scriptId, characterId, scenes } = req.body as {
        teamId: number;
        scriptId: string;
        characterId: number;
        scenes: Array<{
          sceneId: string;
          sceneNumber: number;
          userRefinement?: string;
          supportingImageKeys?: string[];
        }>;
      };

      if (!teamId || !scriptId || !characterId || !scenes?.length) {
        return res.status(400).json({
          error: "teamId, scriptId, characterId, and scenes array are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      // Fetch the script
      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, scriptId));

      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }

      const scriptsData = script.scripts_data as any[];
      const selectedScript = scriptsData[script.selected_variant_index];

      const jobIds: string[] = [];

      // Create jobs for each scene
      for (const sceneRequest of scenes) {
        const sceneData = selectedScript?.scenes?.find(
          (s: SceneData) => s.id === sceneRequest.sceneId
        ) as SceneData | undefined;

        if (!sceneData) {
          console.warn(
            `[SCENE_BUILDER] Scene ${sceneRequest.sceneId} not found, skipping`
          );
          continue;
        }

        const prompt = this.buildScenePrompt(
          sceneData,
          sceneRequest.userRefinement
        );

        const [job] = await db
          .insert(sceneImageGenerationJobs)
          .values({
            team_id: teamId,
            user_id: req.user.dbUserId,
            script_id: scriptId,
            scene_id: sceneRequest.sceneId,
            scene_number: sceneRequest.sceneNumber,
            character_id: characterId,
            prompt,
            user_refinement: sceneRequest.userRefinement || null,
            supporting_image_keys: sceneRequest.supportingImageKeys || [],
            status: "queued",
            progress: 0,
            progress_message: "Queued for generation...",
          })
          .returning();

        await sqsService.sendGenerateSceneImageJob({
          jobId: job.id,
          teamId,
          userId: req.user.dbUserId,
          scriptId,
          sceneId: sceneRequest.sceneId,
          sceneNumber: sceneRequest.sceneNumber,
          characterId,
          sceneData: {
            sceneType: sceneData.sceneType,
            action: sceneData.action,
            dialogue: sceneData.dialogue,
            emotion: sceneData.emotion,
            shotType: sceneData.shotType,
            cameraAngle: sceneData.cameraAngle,
            cinematicPrompt: sceneData.cinematicPrompt,
          },
          productImageKeys: script.product_image_keys as string[],
          userRefinement: sceneRequest.userRefinement,
          supportingImageKeys: sceneRequest.supportingImageKeys || [],
        });

        jobIds.push(job.id);
      }

      return res.status(202).json({
        success: true,
        jobIds,
        message: `${jobIds.length} scene image generation jobs queued.`,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Generate all scene images error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue batch generation",
      });
    }
  }

  /**
   * Get generation status for a job
   */
  async getGenerationStatus(req: AuthRequest, res: Response) {
    try {
      const jobId = req.params.jobId;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const [job] = await db
        .select()
        .from(sceneImageGenerationJobs)
        .where(eq(sceneImageGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const response: any = {
        success: true,
        jobId: job.id,
        sceneId: job.scene_id,
        sceneNumber: job.scene_number,
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      };

      if (job.status === "completed" && job.generated_images) {
        const imageKeys = job.generated_images as string[];
        const imageUrls = await Promise.all(
          imageKeys.map((key) => s3Service.getPresignedUrl(key, 3600))
        );

        response.images = imageKeys.map((key, i) => ({
          key,
          url: imageUrls[i],
          index: i,
        }));
      }

      if (job.status === "failed") {
        response.error = job.error_message;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[SCENE_BUILDER] Get generation status error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get status",
      });
    }
  }

  /**
   * Get all scene images for a script
   */
  async getSceneImages(req: AuthRequest, res: Response) {
    try {
      const scriptId = req.params.scriptId;

      if (!scriptId) {
        return res.status(400).json({ error: "scriptId is required" });
      }

      const images = await db
        .select()
        .from(sceneImages)
        .where(eq(sceneImages.script_id, scriptId));

      // Get presigned URLs for each image
      const imagesWithUrls = await Promise.all(
        images.map(async (img) => ({
          ...img,
          imageUrl: await s3Service.getPresignedUrl(img.image_key, 3600),
        }))
      );

      // Convert to a map by sceneId for easy lookup
      const sceneImagesMap: Record<string, any> = {};
      for (const img of imagesWithUrls) {
        sceneImagesMap[img.scene_id] = img;
      }

      return res.status(200).json({
        success: true,
        sceneImages: sceneImagesMap,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Get scene images error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to get scene images",
      });
    }
  }

  /**
   * Select/save an image for a scene
   */
  async selectSceneImage(req: AuthRequest, res: Response) {
    try {
      const { scriptId, sceneId, sceneNumber, imageKey, generationJobId } =
        req.body;

      if (!scriptId || !sceneId || !imageKey || sceneNumber === undefined) {
        return res.status(400).json({
          error: "scriptId, sceneId, sceneNumber, and imageKey are required",
        });
      }

      // Check if a scene image already exists
      const [existing] = await db
        .select()
        .from(sceneImages)
        .where(
          and(
            eq(sceneImages.script_id, scriptId),
            eq(sceneImages.scene_id, sceneId)
          )
        );

      if (existing) {
        // Update existing
        const [updated] = await db
          .update(sceneImages)
          .set({
            image_key: imageKey,
            generation_job_id: generationJobId || null,
            updated_at: new Date(),
          })
          .where(eq(sceneImages.id, existing.id))
          .returning();

        return res.status(200).json({
          success: true,
          sceneImage: updated,
        });
      } else {
        // Create new
        const [created] = await db
          .insert(sceneImages)
          .values({
            script_id: scriptId,
            scene_id: sceneId,
            scene_number: sceneNumber,
            image_key: imageKey,
            generation_job_id: generationJobId || null,
          })
          .returning();

        return res.status(201).json({
          success: true,
          sceneImage: created,
        });
      }
    } catch (error) {
      console.error("[SCENE_BUILDER] Select scene image error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to select scene image",
      });
    }
  }

  /**
   * Get presigned upload URL for supporting images
   */
  async getUploadUrl(req: AuthRequest, res: Response) {
    try {
      const { teamId, fileName } = req.body;

      if (!teamId || !fileName) {
        return res
          .status(400)
          .json({ error: "teamId and fileName are required" });
      }

      const { uploadUrl, s3Key } =
        await s3Service.getSceneImagePresignedUpload(teamId, fileName);

      return res.status(200).json({
        success: true,
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Get upload URL error:", error);
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to get upload URL",
      });
    }
  }

  /**
   * Build the scene image prompt using cinematicPrompt from script
   */
  private buildScenePrompt(
    sceneData: SceneData,
    userRefinement?: string
  ): string {
    const parts: string[] = [
      "REFERENCE IMAGES PROVIDED: Use the character reference image to maintain consistent identity. This must be the EXACT SAME person.",
      "",
      "SCENE VISUAL DIRECTION:",
      sceneData.cinematicPrompt,
      "",
      "ADDITIONAL CONTEXT:",
      `- Scene Type: ${sceneData.sceneType}`,
      `- Camera Angle: ${sceneData.cameraAngle}`,
      `- Emotion: ${sceneData.emotion}`,
      `- Action: ${sceneData.action}`,
    ];

    if (userRefinement) {
      parts.push("", `USER NOTES: ${userRefinement}`);
    }

    parts.push(
      "",
      "TECHNICAL REQUIREMENTS:",
      "- Photorealistic, UGC/iPhone aesthetic",
      "- Vertical 3:4 aspect ratio",
      "- Natural lighting",
      `- Expression matches emotion: ${sceneData.emotion}`,
      "",
      "NEGATIVE: Cartoon, illustration, watermarks, text overlays, deformed features"
    );

    return parts.join("\n");
  }
}

export const sceneBuilderController = new SceneBuilderController();
