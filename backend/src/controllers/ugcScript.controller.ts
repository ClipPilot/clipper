import { Request, Response } from "express";
import { s3Service } from "../services/s3.service";
import { ugcScriptService } from "../services/ugcScript.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";

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
        productDescription,
        scriptDirection,
        targetDuration,
        numberOfVariations,
        structureId,
        customPattern,
      } = req.body;

      if (!teamId || !characterId || !productImageKeys?.length) {
        return res.status(400).json({
          error: "teamId, characterId, and at least one product image are required",
        });
      }

      if (productImageKeys.length > 5) {
        return res.status(400).json({ error: "Maximum 5 product images allowed" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      const character = await ugcScriptService.getCharacterById(characterId);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const productImageUrls = await Promise.all(
        productImageKeys.map((key: string) => s3Service.getPresignedUrl(key, 3600))
      );

      const scripts = await ugcScriptService.generateScripts({
        productImageUrls,
        productName,
        productDescription,
        scriptDirection,
        character: {
          id: character.id,
          name: character.name,
          gender: character.gender,
          age_range: character.age_range,
          appearance_config: character.appearance_config,
        },
        targetDuration: targetDuration || 30,
        numberOfVariations: numberOfVariations || 2,
        structureId: structureId || "classic",
        customPattern,
      });

      console.log(
        "[UGC_SCRIPT] Generated scripts with cinematic prompts:",
        scripts.map((s) =>
          s.scenes.map((sc) => ({
            sceneId: sc.id,
            cinematicPrompt: sc.cinematicPrompt?.substring(0, 50) + "...",
          }))
        )
      );

      const clientScripts = scripts.map((script) =>
        ugcScriptService.stripCinematicPrompts(script)
      );

      const scriptId = await ugcScriptService.storeFullScripts(
        teamId,
        characterId,
        productImageKeys,
        productName,
        scriptDirection,
        scripts
      );

      return res.status(200).json({
        success: true,
        scripts: clientScripts,
        scriptId,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Generate script error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to generate script",
      });
    }
  }

  async regenerateScene(req: AuthRequest, res: Response) {
    try {
      const { teamId, scriptId, sceneId, currentDialogue, currentEmotion, regenerationType } =
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
      });

      const { cinematicPrompt, cameraDirection, ...clientScene } = updatedScene;

      return res.status(200).json({
        success: true,
        scene: clientScene,
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Regenerate scene error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to regenerate scene",
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
        error: error instanceof Error ? error.message : "Failed to get upload URL",
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
        error: error instanceof Error ? error.message : "Failed to update script",
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
      });
    } catch (error) {
      console.error("[UGC_SCRIPT] Get full script error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get script",
      });
    }
  }
}

export const ugcScriptController = new UGCScriptController();
