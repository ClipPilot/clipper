import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript } from "./shared.js";

export const changeShotTypeTool = createTool({
  id: "change-shot-type",
  description:
    "Change the shot type of a specific b-roll shot (CHARACTER, PRODUCT, or CHARACTER_AND_PRODUCT). Marks thumbnail as needing regeneration.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number containing the shot (1-based)"),
    shotIndex: z
      .number()
      .min(0)
      .describe("0-based index of the shot within the scene's bRollShots array"),
    newShotType: z
      .enum(["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"])
      .describe("New shot type"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    thumbnailNeeded: z.boolean(),
    sceneId: z.string(),
    message: z.string(),
  }),
  execute: async ({
    scriptId,
    variantIndex,
    sceneNumber,
    shotIndex,
    newShotType,
  }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (!scene.bRollShots || !scene.bRollShots[shotIndex]) {
      throw new Error(
        `Shot index ${shotIndex} not found in scene ${sceneNumber}`,
      );
    }

    const oldType = scene.bRollShots[shotIndex].shotType;
    scene.bRollShots[shotIndex].shotType = newShotType;

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      thumbnailNeeded: true,
      sceneId: scene.id,
      message: `Changed shot ${shotIndex + 1} in scene ${sceneNumber} from ${oldType} to ${newShotType}. Thumbnail regeneration recommended.`,
    };
  },
});
