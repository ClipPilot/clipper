import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript } from "./shared.js";

export const removeShotsTool = createTool({
  id: "remove-shots",
  description:
    "Remove one or more shots from a b-roll/visual scene by their indices. At least 1 shot must remain.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number containing the shots (1-based)"),
    shotIndices: z
      .array(z.number().min(0))
      .min(1)
      .describe("0-based indices of shots to remove"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    remainingShotCount: z.number(),
    message: z.string(),
  }),
  execute: async ({ scriptId, variantIndex, sceneNumber, shotIndices }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (scene.shotType === "a-roll") {
      throw new Error("Cannot remove shots from an a-roll scene (a-roll has no shots array)");
    }

    if (!scene.bRollShots || scene.bRollShots.length === 0) {
      throw new Error("Scene has no shots to remove");
    }

    const remaining = scene.bRollShots.length - shotIndices.length;
    if (remaining < 1) {
      throw new Error(
        `Cannot remove ${shotIndices.length} shots — b-roll/visual scenes must have at least 1 shot. Scene has ${scene.bRollShots.length}.`,
      );
    }

    // Remove in reverse order to preserve indices
    const sorted = [...shotIndices].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (idx < 0 || idx >= scene.bRollShots.length) {
        throw new Error(`Shot index ${idx} is out of range (0-${scene.bRollShots.length - 1})`);
      }
      scene.bRollShots.splice(idx, 1);
    }

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      remainingShotCount: scene.bRollShots.length,
      message: `Removed ${shotIndices.length} shot(s) from scene ${sceneNumber}. ${scene.bRollShots.length} shot(s) remaining.`,
    };
  },
});
