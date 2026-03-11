import { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { ugcScriptService } from "../services/ai-ugc/ugcScript.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { db } from "../db";
import { ugcScripts, characters } from "@clipper/shared-db/src/schema";
import { eq, desc, and } from "drizzle-orm";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

export class UGCScriptController {
  async generateScript(req: AuthRequest, res: Response) {
    try {
      const {
        teamId,
        characterId,
        productImageKeys,
        productName,
        scriptDirection,
        targetDuration,
        numberOfVariations,
        structureId,
        customPattern,
        isSilent,
      } = req.body;

      if (!teamId || !characterId) {
        return res.status(400).json({
          error: "teamId and characterId are required",
        });
      }

      if (productImageKeys && productImageKeys.length > 5) {
        return res.status(400).json({ error: "Maximum 5 product images allowed" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const character = await ugcScriptService.getCharacterById(characterId);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const [job] = await db
        .insert(ugcScripts)
        .values({
          team_id: teamId,
          character_id: characterId,
          product_image_keys: productImageKeys || [],
          product_name: productName || null,
          script_direction: scriptDirection || null,
          structure_id: structureId || "classic",
          custom_pattern: customPattern || null,
          target_duration: targetDuration || 30,
          number_of_variations: numberOfVariations || 2,
          status: "queued",
          progress: 0,
          progress_message: "Queued for generation...",
        })
        .returning();

      await sqsService.sendGenerateScriptJob({
        jobId: job.id,
        teamId,
        userId: req.user.dbUserId,
        characterId,
        productImageKeys: productImageKeys || [],
        productName,
        scriptDirection,
        targetDuration: targetDuration || 30,
        numberOfVariations: numberOfVariations || 2,
        structureId: structureId || "classic",
        customPattern,
        isSilent: !!isSilent,
      });

      return res.status(202).json({
        success: true,
        scriptId: job.id,
        status: "queued",
        message: "Script generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Generate script error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to queue script generation"),
      });
    }
  }

  async getScriptStatus(req: AuthRequest, res: Response) {
    try {
      const { scriptId } = req.params;

      if (!scriptId) {
        return res.status(400).json({ error: "scriptId is required" });
      }

      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, scriptId));

      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }

      const response: any = {
        success: true,
        scriptId: script.id,
        status: script.status,
        progress: script.progress,
        progressMessage: script.progress_message,
        createdAt: script.created_at,
        startedAt: script.started_at,
        completedAt: script.completed_at,
      };

      if (script.status === "completed" && script.scripts_data) {
        // Strip cinematic prompts from client response
        const scripts = script.scripts_data as any[];
        response.scripts = scripts.map((s) =>
          ugcScriptService.stripCinematicPrompts(s)
        );
        response.selectedVariantIndex = script.selected_variant_index;
      }

      if (script.status === "failed") {
        response.error = script.error_message;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[UGC_SCRIPT] Get script status error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get script status"),
      });
    }
  }

  async regenerateScene(req: AuthRequest, res: Response) {
    try {
      const { teamId, scriptId, sceneId, currentDialogue, currentEmotion, regenerationType, customPrompt } =
        req.body;

      if (!scriptId || !sceneId) {
        return res.status(400).json({ error: "scriptId and sceneId are required" });
      }

      const updatedScene = await ugcScriptService.regenerateScene({
        scriptId,
        sceneId,
        currentDialogue,
        currentEmotion,
        regenerationType: regenerationType || "full",
        customPrompt,
      });

      const { cinematicPrompt, ...clientScene } = updatedScene;

      return res.status(200).json({
        success: true,
        scene: clientScene,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Regenerate scene error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to regenerate scene"),
      });
    }
  }

  async regenerateBRollPrompt(req: AuthRequest, res: Response) {
    try {
      const { scriptId, sceneId, bRollShotIndex, newAction } = req.body;

      if (!scriptId || !sceneId || bRollShotIndex === undefined || !newAction) {
        return res.status(400).json({
          error: "scriptId, sceneId, bRollShotIndex, and newAction are required"
        });
      }

      await ugcScriptService.regenerateBRollPrompt({
        scriptId,
        sceneId,
        bRollShotIndex,
        newAction,
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("[UGC_SCRIPT] Regenerate B-roll prompt error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to regenerate B-roll prompt"),
      });
    }
  }

  async regenerateAllBRollShots(req: AuthRequest, res: Response) {
    try {
      const { scriptId, sceneId, newSceneAction, shotCount, shotDurations } = req.body;

      if (!scriptId || !sceneId || !newSceneAction || !shotCount || !shotDurations) {
        return res.status(400).json({
          error: "scriptId, sceneId, newSceneAction, shotCount, and shotDurations are required",
        });
      }

      const newShots = await ugcScriptService.regenerateAllBRollShots({
        scriptId,
        sceneId,
        newSceneAction,
        shotCount,
        shotDurations,
      });

      return res.status(200).json({ success: true, bRollShots: newShots });
    } catch (error) {
      console.error("[UGC_SCRIPT] Regenerate all B-roll shots error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to regenerate B-roll shots"),
      });
    }
  }

  async generateAutoStructure(req: AuthRequest, res: Response) {
    try {
      const { scriptDirection, productName, hasProductImages } = req.body;

      if (!scriptDirection || !scriptDirection.trim()) {
        return res.status(400).json({
          error: "scriptDirection is required",
        });
      }

      const result = await ugcScriptService.generateAutoStructure({
        scriptDirection,
        productName,
        hasProductImages: !!hasProductImages,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Auto structure error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to generate auto structure"),
      });
    }
  }

  async initStructure(req: AuthRequest, res: Response) {
    try {
      const { message, productImageKeys } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "message is required" });
      }

      if (productImageKeys && productImageKeys.length > 5) {
        return res.status(400).json({ error: "Maximum 5 product images allowed" });
      }

      const result = await ugcScriptService.initStructure({
        message,
        productImageKeys,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Init structure error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to generate init structure"),
      });
    }
  }

  async getUploadUrl(req: AuthRequest, res: Response) {
    try {
      const { teamId, fileName, contentType } = req.body;

      if (!teamId || !fileName) {
        return res.status(400).json({ error: "teamId and fileName are required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const { uploadUrl, s3Key } = await s3Service.getProductImagePresignedUpload(
        teamId,
        fileName,
        contentType || "image/jpeg"
      );

      return res.status(200).json({
        success: true,
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Upload URL error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get upload URL"),
      });
    }
  }

  async updateScript(req: AuthRequest, res: Response) {
    try {
      const { scriptId } = req.params;
      const { scenes, selectedVariantIndex } = req.body;

      const updated = await ugcScriptService.updateScript(scriptId, {
        scenes,
        selectedVariantIndex,
      });

      if (!updated) {
        return res.status(404).json({ error: "Script not found" });
      }

      const clientScripts = updated.scripts.map((script) =>
        ugcScriptService.stripCinematicPrompts(script)
      );

      return res.status(200).json({
        success: true,
        scripts: clientScripts,
        selectedVariantIndex: updated.selectedVariantIndex,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Update script error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to update script"),
      });
    }
  }

  async getFullScript(req: AuthRequest, res: Response) {
    try {
      const { scriptId } = req.params;

      const fullScript = await ugcScriptService.getFullScript(scriptId);

      if (!fullScript) {
        return res.status(404).json({ error: "Script not found" });
      }

      return res.status(200).json({
        success: true,
        scripts: fullScript.scripts,
        selectedVariantIndex: fullScript.selectedVariantIndex,
        characterId: fullScript.characterId,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Get full script error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get script"),
      });
    }
  }

  async listScripts(req: AuthRequest, res: Response) {
    try {
      const { teamId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      const team = await teamService.getTeamById(parseInt(teamId));
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      // Fetch completed scripts with character info
      const scriptsWithCharacters = await db
        .select({
          id: ugcScripts.id,
          productName: ugcScripts.product_name,
          scriptDirection: ugcScripts.script_direction,
          structureId: ugcScripts.structure_id,
          scriptsData: ugcScripts.scripts_data,
          selectedVariantIndex: ugcScripts.selected_variant_index,
          createdAt: ugcScripts.created_at,
          characterId: ugcScripts.character_id,
          characterName: characters.name,
        })
        .from(ugcScripts)
        .leftJoin(characters, eq(ugcScripts.character_id, characters.id))
        .where(
          and(
            eq(ugcScripts.team_id, parseInt(teamId)),
            eq(ugcScripts.status, "completed")
          )
        )
        .orderBy(desc(ugcScripts.created_at))
        .limit(limit)
        .offset(offset);

      // Format response with script summary
      const formattedScripts = scriptsWithCharacters.map((script) => {
        const scriptsData = script.scriptsData as any[] | null;
        const selectedScript = scriptsData?.[script.selectedVariantIndex || 0];
        const sceneCount = selectedScript?.scenes?.length || 0;
        const totalDuration = selectedScript?.scenes?.reduce(
          (sum: number, s: any) => sum + (s.estimatedDurationSeconds || 0),
          0
        ) || 0;

        return {
          id: script.id,
          productName: script.productName,
          scriptDirection: script.scriptDirection,
          structureId: script.structureId,
          characterId: script.characterId,
          characterName: script.characterName,
          sceneCount,
          totalDuration,
          title: selectedScript?.title || "Untitled Script",
          hook: selectedScript?.hook || "",
          viralScore: selectedScript?.viralScore || 0,
          createdAt: script.createdAt,
        };
      });

      return res.status(200).json({
        success: true,
        scripts: formattedScripts,
        hasMore: formattedScripts.length === limit,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] List scripts error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to list scripts"),
      });
    }
  }
}

export const ugcScriptController = new UGCScriptController();
