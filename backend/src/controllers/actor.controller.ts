import { Request, Response } from "express";
import { db } from "../db";
import { characters, characterGenerationJobs } from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import {
  generateCharacterImages,
  generateVariationImages,
  buildPromptFromConfig,
  CharacterConfig,
  AppearanceConfig,
  StyleConfig,
} from "../services/characterGeneration.service";
import { canAccessUGCStudio } from "../utils/plans";
import { teamService } from "../services/team.service";
import { eq, desc, and, sql } from "drizzle-orm";
import crypto from "crypto";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

const CREDIT_PER_IMAGE = 1;

export class ActorController {
  async generatePreview(req: AuthRequest, res: Response) {
    try {
      const { teamId, config, parentCharacterId } = req.body as {
        teamId: number;
        config: CharacterConfig;
        parentCharacterId?: number;
      };

      if (!teamId || !config) {
        return res.status(400).json({ error: "teamId and config are required" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const [job] = await db
        .insert(characterGenerationJobs)
        .values({
          team_id: teamId,
          user_id: req.user.dbUserId,
          config,
          parent_character_id: parentCharacterId || null,
          status: "queued",
          progress: 0,
          progress_message: "Queued for generation...",
        })
        .returning();

      await sqsService.sendGenerateCharacterJob({
        jobId: job.id,
        teamId,
        userId: req.user.dbUserId,
        config: {
          gender: config.gender,
          ageRange: config.ageRange,
          appearance: config.appearance,
          style: config.style,
          referenceImages: config.referenceImages,
        },
        parentCharacterId,
      });

      return res.status(202).json({
        success: true,
        jobId: job.id,
        status: "queued",
        message: "Character generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[ACTOR] Generate preview error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to queue generation",
      });
    }
  }

  async getGenerationStatus(req: AuthRequest, res: Response) {
    try {
      const jobId = req.params.jobId;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const [job] = await db
        .select()
        .from(characterGenerationJobs)
        .where(eq(characterGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const response: any = {
        success: true,
        jobId: job.id,
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
        response.prompt = job.generation_prompt;
      }

      if (job.status === "failed") {
        response.error = job.error_message;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[ACTOR] Get generation status error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get status",
      });
    }
  }

  async create(req: AuthRequest, res: Response) {
    try {
      const {
        teamId,
        name,
        isPublic,
        gender,
        ageRange,
        appearanceConfig,
        styleConfig,
        selectedImageKeys,
        generationPrompt,
        referenceImages,
        parentCharacterId,
      } = req.body;

      if (!teamId || !name || !selectedImageKeys?.length) {
        return res.status(400).json({
          error: "teamId, name, and selectedImageKeys are required",
        });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const creditCost = selectedImageKeys.length * CREDIT_PER_IMAGE;

      const [character] = await db
        .insert(characters)
        .values({
          team_id: teamId,
          name,
          public: isPublic || false,
          gender,
          age_range: ageRange,
          appearance_config: appearanceConfig,
          style_config: styleConfig,
          character_images: selectedImageKeys,
          primary_image_index: 0,
          reference_images: referenceImages || null,
          generation_prompt: generationPrompt,
          parent_character_id: parentCharacterId || null,
          is_variation: !!parentCharacterId,
        })
        .returning();

      if (parentCharacterId) {
        await db
          .update(characters)
          .set({ uses_count: sql`${characters.uses_count} + 1` })
          .where(eq(characters.id, parentCharacterId));
      }

      return res.status(201).json({
        success: true,
        character,
        creditCost,
      });
    } catch (error) {
      console.error("[ACTOR] Create error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create character",
      });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const teamId = parseInt(req.query.teamId as string);

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      const result = await db
        .select()
        .from(characters)
        .where(eq(characters.team_id, teamId))
        .orderBy(desc(characters.created_at));

      const charactersWithUrls = await Promise.all(
        result.map(async (char) => {
          const images = char.character_images as string[];
          const imageUrls = await Promise.all(
            images.map((key) => s3Service.getPresignedUrl(key, 3600))
          );
          return {
            ...char,
            imageUrls,
          };
        })
      );

      return res.status(200).json({
        success: true,
        characters: charactersWithUrls,
      });
    } catch (error) {
      console.error("[ACTOR] List error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list characters",
      });
    }
  }

  async listCommunity(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db
        .select()
        .from(characters)
        .where(eq(characters.public, true))
        .orderBy(desc(characters.uses_count))
        .limit(limit)
        .offset(offset);

      const charactersWithUrls = await Promise.all(
        result.map(async (char) => {
          const images = char.character_images as string[];
          const primaryUrl = await s3Service.getPresignedUrl(
            images[char.primary_image_index || 0],
            3600
          );
          return {
            ...char,
            primaryImageUrl: primaryUrl,
          };
        })
      );

      return res.status(200).json({
        success: true,
        characters: charactersWithUrls,
      });
    } catch (error) {
      console.error("[ACTOR] List community error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list community characters",
      });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      const [character] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, id));

      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const images = character.character_images as string[];
      const imageUrls = await Promise.all(
        images.map((key) => s3Service.getPresignedUrl(key, 3600))
      );

      return res.status(200).json({
        success: true,
        character: {
          ...character,
          imageUrls,
        },
      });
    } catch (error) {
      console.error("[ACTOR] Get by ID error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get character",
      });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, isPublic, primaryImageIndex } = req.body;

      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (isPublic !== undefined) updateData.public = isPublic;
      if (primaryImageIndex !== undefined) updateData.primary_image_index = primaryImageIndex;
      updateData.updated_at = new Date();

      const [updated] = await db
        .update(characters)
        .set(updateData)
        .where(eq(characters.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Character not found" });
      }

      return res.status(200).json({
        success: true,
        character: updated,
      });
    } catch (error) {
      console.error("[ACTOR] Update error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update character",
      });
    }
  }

  async delete(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      const [deleted] = await db
        .delete(characters)
        .where(eq(characters.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Character not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Character deleted",
      });
    } catch (error) {
      console.error("[ACTOR] Delete error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete character",
      });
    }
  }

  async incrementUse(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }

      await db
        .update(characters)
        .set({ uses_count: sql`${characters.uses_count} + 1` })
        .where(eq(characters.id, id));

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[ACTOR] Increment use error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to increment use count",
      });
    }
  }

  async createVariation(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { teamId, styleConfig } = req.body as {
        teamId: number;
        styleConfig: StyleConfig;
      };

      if (!id || !teamId || !styleConfig) {
        return res.status(400).json({
          error: "id, teamId, and styleConfig are required",
        });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const [original] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, id));

      if (!original) {
        return res.status(404).json({ error: "Character not found" });
      }

      const tempCharacterId = crypto.randomUUID();
      const appearance = original.appearance_config as AppearanceConfig;

      const imageKeys = await generateVariationImages(
        appearance,
        original.gender || "female",
        original.age_range || "25-35",
        styleConfig,
        teamId,
        tempCharacterId
      );

      const imageUrls = await Promise.all(
        imageKeys.map((key) => s3Service.getPresignedUrl(key, 3600))
      );

      return res.status(200).json({
        success: true,
        tempCharacterId,
        images: imageKeys.map((key, i) => ({
          key,
          url: imageUrls[i],
          index: i,
        })),
        originalCharacterId: id,
        originalAppearance: appearance,
      });
    } catch (error) {
      console.error("[ACTOR] Create variation error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create variation",
      });
    }
  }

  async getPresignedUploadUrl(req: AuthRequest, res: Response) {
    try {
      const { teamId, fileName } = req.body;

      if (!teamId || !fileName) {
        return res.status(400).json({ error: "teamId and fileName are required" });
      }

      const { uploadUrl, s3Key } = await s3Service.getCharacterImagePresignedUpload(
        teamId,
        fileName
      );

      return res.status(200).json({
        success: true,
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      console.error("[ACTOR] Presigned URL error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get presigned URL",
      });
    }
  }
}

export const actorController = new ActorController();
