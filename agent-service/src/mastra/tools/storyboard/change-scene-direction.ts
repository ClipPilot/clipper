import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript } from "./shared.js";
import { generateCinematicPrompt } from "./llm.js";

export const changeSceneDirectionTool = createTool({
  id: "change-scene-direction",
  description:
    "Change a scene's action and/or cinematic direction. Regenerates the cinematicPrompt automatically when only a new action is provided. Marks thumbnail as needing regeneration.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to modify (1-based)"),
    newAction: z
      .string()
      .optional()
      .describe("New action description for the scene"),
    newCinematicPrompt: z
      .string()
      .optional()
      .describe(
        "New cinematic prompt. If omitted, will be auto-generated from newAction.",
      ),
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
    newAction,
    newCinematicPrompt,
  }) => {
    if (!newAction && !newCinematicPrompt) {
      throw new Error(
        "At least one of newAction or newCinematicPrompt must be provided",
      );
    }

    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (newAction) {
      scene.action = newAction;
    }

    if (newCinematicPrompt) {
      scene.cinematicPrompt = newCinematicPrompt;
    } else if (newAction) {
      scene.cinematicPrompt = await generateCinematicPrompt(newAction);
    }

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      thumbnailNeeded: true,
      sceneId: scene.id,
      message: `Updated direction for scene ${sceneNumber} ("${scene.sceneType}"). Thumbnail regeneration recommended.`,
    };
  },
});
