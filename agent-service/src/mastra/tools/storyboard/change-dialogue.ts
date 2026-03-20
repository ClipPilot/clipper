import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript, estimateDurationFromDialogue } from "./shared.js";

export const changeDialogueTool = createTool({
  id: "change-dialogue",
  description:
    "Change the dialogue for a scene. Automatically recalculates duration. Dialogue must include ElevenLabs emotion tags like [excited], [sincere], etc.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to modify (1-based)"),
    newDialogue: z
      .string()
      .describe(
        'New dialogue text with ElevenLabs emotion tags. Example: "[excited] Oh my god, you guys need to see this!"',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    newDuration: z.number(),
    message: z.string(),
  }),
  execute: async ({ scriptId, variantIndex, sceneNumber, newDialogue }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    // Visual/silent scenes shouldn't have dialogue
    if (scene.shotType === "b-roll" && (!scene.dialogue || scene.dialogue.trim() === "")) {
      // This was a silent b-roll, allow setting dialogue (converts to voiced b-roll)
    }

    scene.dialogue = newDialogue;
    scene.estimatedDurationSeconds = estimateDurationFromDialogue(newDialogue);

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      newDuration: scene.estimatedDurationSeconds,
      message: `Updated dialogue for scene ${sceneNumber}. Estimated duration: ${scene.estimatedDurationSeconds}s.`,
    };
  },
});
