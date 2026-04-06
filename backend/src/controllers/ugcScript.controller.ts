import { Request, Response } from "express";
import type { ErrorResponse } from "../types/api.types";
import { s3Service } from "../services/s3.service";
import { ugcScriptService } from "../services/ai-ugc/ugcScript.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { db } from "../db";
import { ugcScripts, characters, ugcVideoGenerationJobs } from "@clipper/shared-db/src/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { handleControllerError, verifyTeamAccessOrFail } from "../utils/controllerHelpers";
import { AuthRequest } from "../middleware/auth.middleware";

export class UGCScriptController {
  async getScriptStatus(req: AuthRequest, res: Response<any | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Get script status error", error, "Failed to get script status");
    }
  }

  async regenerateScene(req: AuthRequest, res: Response<{ success: boolean; scene: any } | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Regenerate scene error", error, "Failed to regenerate scene");
    }
  }

  async regenerateBRollPrompt(req: AuthRequest, res: Response<{ success: boolean } | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Regenerate B-roll prompt error", error, "Failed to regenerate B-roll prompt");
    }
  }

  async regenerateAllBRollShots(req: AuthRequest, res: Response<{ success: boolean; bRollShots: any[] } | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Regenerate all B-roll shots error", error, "Failed to regenerate B-roll shots");
    }
  }

  async generateAutoStructure(req: AuthRequest, res: Response<{ success: boolean } | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Auto structure error", error, "Failed to generate auto structure");
    }
  }

  async generateScriptAgent(req: AuthRequest, res: Response<{ success: boolean; scriptId: string; script: any } | ErrorResponse>) {
    try {
      const {
        teamId,
        characterId,
        characters,
        structure,
        character,
        voice,
        targetAudience,
        productImageKeys,
        userDirection,
        isSilent,
        videoType,
      } = req.body;

      if (!teamId || !structure) {
        return res.status(400).json({ error: "teamId and structure are required" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const result = await ugcScriptService.generateScriptViaAgent({
        teamId,
        characterId,
        characters,
        structure,
        character,
        voice,
        targetAudience: targetAudience || "",
        productImageKeys,
        userDirection,
        isSilent: !!isSilent,
        videoType: videoType || "ugc",
      });

      return res.status(200).json({
        success: true,
        scriptId: result.scriptId,
        script: result.script,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_SCRIPT] Generate script agent error", error, "Failed to generate script via agent");
    }
  }

  async saveScript(req: AuthRequest, res: Response<{ success: boolean; scriptId: string } | ErrorResponse>) {
    try {
      const { teamId, script, characterId, productImageKeys, isSilent, videoType } = req.body;

      if (!teamId || !script) {
        return res.status(400).json({ error: "teamId and script are required" });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const insertValues: Record<string, unknown> = {
        team_id: teamId,
        product_image_keys: productImageKeys || [],
        scripts_data: [script],
        selected_variant_index: 0,
        status: "completed",
        is_silent: !!isSilent,
        has_character: !!characterId,
        video_type: videoType || "ugc",
      };
      if (characterId) {
        insertValues.character_id = characterId;
      }

      const [inserted] = await db
        .insert(ugcScripts)
        .values(insertValues as any)
        .returning({ id: ugcScripts.id });

      return res.status(200).json({
        success: true,
        scriptId: inserted.id,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_SCRIPT] Save script error", error, "Failed to save script");
    }
  }

  async initStructure(req: AuthRequest, res: Response<{ success: boolean } | ErrorResponse>) {
    try {
      const { message, productImageKeys, threadId, conversationHistory } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "message is required" });
      }

      if (productImageKeys && productImageKeys.length > 5) {
        return res.status(400).json({ error: "Maximum 5 product images allowed" });
      }

      const result = await ugcScriptService.initStructure({
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
      return handleControllerError(res, "[UGC_SCRIPT] Init structure error", error, "Failed to generate init structure");
    }
  }

  async getUploadUrl(req: AuthRequest, res: Response<{ success: boolean; uploadUrl: string; s3Key: string } | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Upload URL error", error, "Failed to get upload URL");
    }
  }

  async updateScript(req: AuthRequest, res: Response<{ success: boolean; scripts: any[]; selectedVariantIndex: number } | ErrorResponse>) {
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
      return handleControllerError(res, "[UGC_SCRIPT] Update script error", error, "Failed to update script");
    }
  }

  async getFullScript(req: AuthRequest, res: Response<{ success: boolean; scripts: any[]; selectedVariantIndex: number; characterId: any; isSilent: boolean; hasCharacter: boolean; videoType: string; charactersConfig: Array<{ characterId: number; voiceId: string | null }> | null; characterCount: number } | ErrorResponse>) {
    try {
      const { scriptId } = req.params;

      const fullScript = await ugcScriptService.getFullScript(scriptId);

      if (!fullScript) {
        return res.status(404).json({ error: "Script not found" });
      }

      const [scriptRow] = await db.select({ team_id: ugcScripts.team_id }).from(ugcScripts).where(eq(ugcScripts.id, scriptId));
      if (scriptRow && !(await verifyTeamAccessOrFail(req, scriptRow.team_id, res))) return;

      return res.status(200).json({
        success: true,
        scripts: fullScript.scripts,
        selectedVariantIndex: fullScript.selectedVariantIndex,
        characterId: fullScript.characterId,
        isSilent: fullScript.isSilent,
        hasCharacter: fullScript.hasCharacter,
        videoType: fullScript.videoType,
        charactersConfig: fullScript.charactersConfig,
        characterCount: fullScript.characterCount,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_SCRIPT] Get full script error", error, "Failed to get script");
    }
  }

  async listScripts(req: AuthRequest, res: Response<{ success: boolean; scripts: any[]; hasMore: boolean } | ErrorResponse>) {
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
          videoJobId: ugcVideoGenerationJobs.id,
        })
        .from(ugcScripts)
        .leftJoin(characters, eq(ugcScripts.character_id, characters.id))
        .leftJoin(ugcVideoGenerationJobs, eq(ugcVideoGenerationJobs.script_id, ugcScripts.id))
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
          hasVideo: !!script.videoJobId,
        };
      });

      return res.status(200).json({
        success: true,
        scripts: formattedScripts,
        hasMore: formattedScripts.length === limit,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_SCRIPT] List scripts error", error, "Failed to list scripts");
    }
  }
  async deleteScript(req: AuthRequest, res: Response<{ success: boolean } | ErrorResponse>) {
    try {
      const { scriptId } = req.params;
      const { teamId } = req.body;

      if (!scriptId) {
        return res.status(400).json({ error: "scriptId is required" });
      }
      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      if (!(await verifyTeamAccessOrFail(req, teamId, res))) return;

      await ugcScriptService.deleteScript(scriptId, teamId);

      return res.status(200).json({ success: true });
    } catch (error) {
      return handleControllerError(res, "[UGC_SCRIPT] Delete script error", error, "Failed to delete script");
    }
  }

  async storyboardChat(req: AuthRequest, res: Response<{ success: boolean } | ErrorResponse>) {
    try {
      const { scriptId, message, threadId, teamId, characterId } = req.body;

      if (!scriptId || !message?.trim()) {
        return res
          .status(400)
          .json({ error: "scriptId and message are required" });
      }

      const result = await ugcScriptService.storyboardChat({
        scriptId,
        message,
        threadId,
        teamId,
        characterId,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_SCRIPT] Storyboard chat error", error, "Failed to process storyboard edit");
    }
  }
}

export const ugcScriptController = new UGCScriptController();
