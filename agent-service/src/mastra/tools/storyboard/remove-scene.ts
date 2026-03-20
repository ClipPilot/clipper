import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript, renumberScenes } from "./shared.js";

export const removeSceneTool = createTool({
  id: "remove-scene",
  description:
    "Remove a scene from the script by its scene number. Renumbers remaining scenes automatically.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to remove (1-based)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    removedSceneId: z.string(),
    remainingSceneCount: z.number(),
    message: z.string(),
  }),
  execute: async ({ scriptId, variantIndex, sceneNumber }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const sceneIndex = script.scenes.findIndex(
      (s) => s.sceneNumber === sceneNumber,
    );
    if (sceneIndex === -1) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (script.scenes.length <= 2) {
      throw new Error("Cannot remove scene: script must have at least 2 scenes");
    }

    const removed = script.scenes.splice(sceneIndex, 1)[0];
    renumberScenes(script.scenes);

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      removedSceneId: removed.id,
      remainingSceneCount: script.scenes.length,
      message: `Removed scene ${sceneNumber} ("${removed.sceneType}"). ${script.scenes.length} scenes remaining.`,
    };
  },
});
