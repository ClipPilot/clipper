import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript } from "./shared.js";
import { generateBRollShotPrompts } from "./llm.js";

export const changeShotDirectionTool = createTool({
  id: "change-shot-direction",
  description:
    "Change the action/direction of a specific b-roll shot. Auto-regenerates cinematicPrompt and shotType classification. Marks thumbnail as needing regeneration.",
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
      .describe("0-based index of the shot within bRollShots"),
    newAction: z
      .string()
      .describe("New action description for the shot"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    thumbnailNeeded: z.boolean(),
    sceneId: z.string(),
    newShotType: z.string(),
    message: z.string(),
  }),
  execute: async ({
    scriptId,
    variantIndex,
    sceneNumber,
    shotIndex,
    newAction,
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

    const shot = scene.bRollShots[shotIndex];

    // Regenerate cinematicPrompt and shotType via LLM
    const generated = await generateBRollShotPrompts({
      action: newAction,
      shotType: shot.shotType,
    });

    shot.action = newAction;
    shot.cinematicPrompt = generated.cinematicPrompt;
    shot.shotType = generated.shotType as "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      thumbnailNeeded: true,
      sceneId: scene.id,
      newShotType: shot.shotType,
      message: `Updated shot ${shotIndex + 1} in scene ${sceneNumber}: "${newAction}" (${shot.shotType}). Thumbnail regeneration recommended.`,
    };
  },
});
