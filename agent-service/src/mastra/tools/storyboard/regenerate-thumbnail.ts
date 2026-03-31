import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, getPool } from "./shared.js";

export const regenerateThumbnailTool = createTool({
  id: "regenerate-thumbnail",
  description:
    "Trigger thumbnail/image regeneration for a scene after visual changes (e.g., wardrobe change, new action, different setting). Calls the backend scene-builder API to queue image generation. Use this after any change that affects how a scene or shot looks visually.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to regenerate images for (1-based)"),
    characterId: z
      .number()
      .describe("The character ID for the scene (needed for image generation)"),
    teamId: z
      .number()
      .describe("The team ID"),
    userRefinement: z
      .string()
      .optional()
      .describe(
        "Optional refinement instructions for the image generation (e.g., 'wearing a red vest', 'brighter lighting')",
      ),
    singleBRollShotIndex: z
      .number()
      .optional()
      .describe(
        "If specified, only regenerate this specific b-roll shot (0-based index). Omit to regenerate all shots in the scene.",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    jobId: z.string().nullable(),
    message: z.string(),
  }),
  execute: async ({
    scriptId,
    variantIndex,
    sceneNumber,
    characterId,
    teamId,
    userRefinement,
    singleBRollShotIndex,
  }) => {
    const { script } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    // Call the backend scene-builder API to queue image generation
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

    const body: Record<string, unknown> = {
      teamId,
      scriptId,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      characterId,
      // Pass scene data so backend doesn't need to re-read from DB
      sceneType: scene.sceneType,
      dialogue: scene.dialogue,
      action: scene.action,
      emotion: scene.emotion,
      shotType: scene.shotType,
      cameraAngle: scene.cameraAngle,
      bRollShots: scene.bRollShots,
      arollShots: scene.arollShots,
    };

    if (userRefinement) {
      body.userRefinement = userRefinement;
    }

    // For a-roll-multi scenes, fetch existing generated images as setting anchors
    // so the image processor can maintain background and attire consistency
    if (scene.shotType === "a-roll-multi") {
      const pool = getPool();
      const existingResult = await pool.query(
        `SELECT generated_images FROM scene_image_generation_jobs
         WHERE script_id = $1 AND scene_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [scriptId, scene.id],
      );
      const existingImages = existingResult.rows[0]?.generated_images as string[] | undefined;
      if (existingImages && existingImages.length > 0) {
        body.settingAnchorKeys = existingImages.slice(0, 2);
      }
    }

    if (singleBRollShotIndex !== undefined) {
      body.singleBRollShotIndex = singleBRollShotIndex;

      const pool = getPool();
      const existingResult = await pool.query(
        `SELECT generated_images FROM scene_image_generation_jobs
         WHERE script_id = $1 AND scene_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [scriptId, scene.id],
      );
      const existingImages = existingResult.rows[0]?.generated_images;
      if (existingImages) {
        body.existingBRollImages = existingImages;
      }
    }

    // Use internal API key for server-to-server auth (bypasses user JWT requirement)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const internalKey = process.env.INTERNAL_API_KEY;
    if (internalKey) {
      headers["x-internal-api-key"] = internalKey;
    }

    const response = await fetch(
      `${backendUrl}/api/scene-builder/generate-scene-images`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[regenerate-thumbnail] Backend error:",
        response.status,
        errorBody,
      );
      return {
        success: false,
        jobId: null,
        message: `Failed to start image regeneration: ${response.status}`,
      };
    }

    const result = (await response.json()) as {
      success: boolean;
      jobId: string;
      sceneId: string;
      singleBRollShotIndex: number | null;
    };

    const shotDesc =
      singleBRollShotIndex !== undefined
        ? `shot ${singleBRollShotIndex + 1} of `
        : "";

    return {
      success: true,
      jobId: result.jobId,
      message: `Image regeneration queued for ${shotDesc}scene ${sceneNumber}${userRefinement ? ` with refinement: "${userRefinement}"` : ""}. The frontend will poll for completion.`,
    };
  },
});
