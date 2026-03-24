import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript } from "./shared.js";
import { generateBRollShotPrompts } from "./llm.js";

export const addShotsTool = createTool({
  id: "add-shots",
  description:
    "Add one or more new shots to a b-roll/visual scene. Auto-generates cinematicPrompt for each shot. Maximum 5 shots per scene.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to add shots to (1-based)"),
    shots: z
      .array(
        z.object({
          action: z
            .string()
            .describe("What happens in this shot (1-2 sentences)"),
          shotType: z
            .enum(["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"])
            .describe("What this shot features"),
          durationSeconds: z
            .number()
            .min(1)
            .max(4)
            .describe("Duration of this shot (1-4 seconds)"),
          productImageNeeded: z
            .boolean()
            .describe("Whether this shot should show the product"),
        }),
      )
      .min(1)
      .max(4)
      .describe("Shots to add"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    thumbnailNeeded: z.boolean(),
    sceneId: z.string(),
    totalShotCount: z.number(),
    message: z.string(),
  }),
  execute: async ({ scriptId, variantIndex, sceneNumber, shots }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (scene.shotType === "a-roll") {
      throw new Error(
        "Cannot add shots to an a-roll scene. A-roll is a single continuous take.",
      );
    }

    const existing = scene.bRollShots?.length || 0;
    if (existing + shots.length > 5) {
      throw new Error(
        `Cannot add ${shots.length} shots — scene already has ${existing} and max is 5.`,
      );
    }

    // Generate cinematicPrompt for each new shot via LLM
    const generatedShots = await Promise.all(
      shots.map(async (shot) => {
        const result = await generateBRollShotPrompts({
          action: shot.action,
          shotType: shot.shotType,
        });
        return {
          action: shot.action,
          cinematicPrompt: result.cinematicPrompt,
          durationSeconds: shot.durationSeconds,
          productImageNeeded: shot.productImageNeeded,
          shotType: result.shotType as
            | "CHARACTER"
            | "PRODUCT"
            | "CHARACTER_AND_PRODUCT",
        };
      }),
    );

    if (!scene.bRollShots) {
      scene.bRollShots = [];
    }
    scene.bRollShots.push(...generatedShots);

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      thumbnailNeeded: true,
      sceneId: scene.id,
      totalShotCount: scene.bRollShots.length,
      message: `Added ${shots.length} shot(s) to scene ${sceneNumber}. Total shots: ${scene.bRollShots.length}. Thumbnail regeneration recommended.`,
    };
  },
});
