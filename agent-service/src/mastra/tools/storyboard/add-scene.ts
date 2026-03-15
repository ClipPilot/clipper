import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { randomUUID } from "crypto";
import { loadScript, saveScript, renumberScenes, type BRollShot } from "./shared.js";
import { generateNewSceneContent, generateShotBreakdown } from "./llm.js";

export const addSceneTool = createTool({
  id: "add-scene",
  description:
    "Add a new scene to the script at a specific position. Generates cinematicPrompt, dialogue, and shots automatically. For b-roll scenes, also generates a shot breakdown.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    afterSceneNumber: z
      .number()
      .min(0)
      .describe("Insert after this scene number. Use 0 to prepend as the first scene."),
    sceneType: z
      .enum([
        "hook",
        "problem",
        "agitate",
        "solution",
        "demo",
        "social-proof",
        "testimonial",
        "transformation",
        "cta",
      ])
      .describe("The story beat / narrative purpose of this scene"),
    shotType: z
      .enum(["a-roll", "b-roll"])
      .describe("a-roll (actor talking to camera) or b-roll (product visuals with voiceover)"),
    action: z
      .string()
      .describe("What the character/product is doing in this scene"),
    dialogue: z
      .string()
      .optional()
      .describe("Optional dialogue. If omitted for a-roll, will be auto-generated."),
    duration: z
      .number()
      .min(2)
      .max(30)
      .optional()
      .describe("Duration in seconds (default: 5)"),
    shotCount: z
      .number()
      .min(1)
      .max(5)
      .optional()
      .describe("Number of shots for b-roll scenes (default: 2). Ignored for a-roll."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    thumbnailNeeded: z.boolean(),
    newSceneId: z.string(),
    newSceneNumber: z.number(),
    message: z.string(),
  }),
  execute: async ({
    scriptId,
    variantIndex,
    afterSceneNumber,
    sceneType,
    shotType,
    action,
    dialogue,
    duration = 5,
    shotCount = 2,
  }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    if (script.scenes.length >= 8) {
      throw new Error("Cannot add scene: script already has 8 scenes (maximum)");
    }

    // Generate scene content via LLM
    const content = await generateNewSceneContent({
      sceneType,
      shotType,
      action,
      storyBeat: sceneType,
      dialogue,
      duration,
    });

    const newSceneId = randomUUID();

    // Generate b-roll shots if needed
    let bRollShots: BRollShot[] | null = null;
    if (shotType === "b-roll") {
      bRollShots = await generateShotBreakdown({
        sceneAction: action,
        shotCount,
        totalDuration: duration,
      });
    }

    const newScene = {
      id: newSceneId,
      sceneNumber: 0, // Will be set by renumber
      sceneType,
      action,
      dialogue: content.dialogue || dialogue || "",
      emotion: content.emotion || "confident",
      estimatedDurationSeconds: duration,
      shotType,
      cameraAngle: content.cameraAngle || "medium-shot",
      cinematicPrompt: content.cinematicPrompt,
      ambientSound: content.ambientSound,
      bRollShots,
      mergedSceneTypes: null,
    };

    // Insert at the correct position
    const insertIndex =
      afterSceneNumber === 0
        ? 0
        : script.scenes.findIndex((s) => s.sceneNumber === afterSceneNumber) + 1;

    if (afterSceneNumber > 0 && insertIndex === 0) {
      throw new Error(`Scene ${afterSceneNumber} not found for insertion point`);
    }

    script.scenes.splice(insertIndex, 0, newScene as any);
    renumberScenes(script.scenes);

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      thumbnailNeeded: true,
      newSceneId,
      newSceneNumber: newScene.sceneNumber,
      message: `Added ${shotType} "${sceneType}" scene at position ${newScene.sceneNumber}. Thumbnail generation recommended.`,
    };
  },
});
