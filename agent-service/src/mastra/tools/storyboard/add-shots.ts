import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript, estimateDurationFromDialogue } from "./shared.js";
import { generateBRollShotPrompts, generateArollShotContent } from "./llm.js";

export const addShotsTool = createTool({
  id: "add-shots",
  description:
    "Add shots to a scene. For b-roll/visual scenes: adds b-roll shots (max 5 total). For a-roll-multi scenes (podcast): adds character conversation turns (max 6 total). Cannot add shots to regular a-roll scenes.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to add shots to (1-based)"),
    bRollShots: z
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
      .optional()
      .describe("B-roll shots to add (only for b-roll/visual scenes)"),
    arollShots: z
      .array(
        z.object({
          action: z
            .string()
            .describe("Physical action — what the character does while speaking toward the microphone"),
          characterIndex: z
            .number()
            .min(0)
            .max(1)
            .describe("Which character speaks (0 or 1)."),
          dialogue: z
            .string()
            .optional()
            .describe("Optional dialogue. If omitted, auto-generated based on the action."),
        }),
      )
      .optional()
      .describe("A-roll conversation turns to add (only for a-roll-multi scenes)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    thumbnailNeeded: z.boolean(),
    sceneId: z.string(),
    totalShotCount: z.number(),
    message: z.string(),
  }),
  execute: async ({ scriptId, variantIndex, sceneNumber, bRollShots, arollShots }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (scene.shotType === "a-roll-multi") {
      if (bRollShots?.length) {
        throw new Error("Cannot add b-roll shots to an a-roll-multi scene. Use arollShots instead.");
      }
      if (!arollShots?.length) {
        throw new Error("arollShots array is required for a-roll-multi scenes.");
      }

      const existing = scene.arollShots?.length || 0;
      if (existing + arollShots.length > 6) {
        throw new Error(
          `Cannot add ${arollShots.length} shots — scene already has ${existing} and max is 6.`,
        );
      }

      const generatedShots = await Promise.all(
        arollShots.map(async (shot) => {
          if (shot.dialogue) {
            const emotionMatch = shot.dialogue.match(/\[([a-z]+)\]/i);
            return {
              dialogue: shot.dialogue,
              action: shot.action,
              emotion: emotionMatch ? emotionMatch[1].toLowerCase() : "confident",
              characterIndex: shot.characterIndex,
              ambientSound: null as string | null,
            };
          }

          const generated = await generateArollShotContent({
            action: shot.action,
            characterIndex: shot.characterIndex,
            sceneContext: scene.action,
          });

          return {
            dialogue: generated.dialogue,
            action: shot.action,
            emotion: generated.emotion || "confident",
            characterIndex: shot.characterIndex,
            ambientSound: generated.ambientSound ?? null,
          };
        }),
      );

      if (!scene.arollShots) {
        scene.arollShots = [];
      }
      scene.arollShots.push(...generatedShots);

      const totalDialogueDuration = scene.arollShots.reduce(
        (sum, s) => sum + estimateDurationFromDialogue(s.dialogue),
        0,
      );
      scene.estimatedDurationSeconds = totalDialogueDuration;

      await saveScript(scriptId, variantIndex, script, allScripts);

      return {
        success: true,
        thumbnailNeeded: true,
        sceneId: scene.id,
        totalShotCount: scene.arollShots.length,
        message: `Added ${arollShots.length} podcast shot(s) to scene ${sceneNumber}. Total shots: ${scene.arollShots.length}. Thumbnail regeneration recommended.`,
      };
    }

    if (scene.shotType === "a-roll") {
      throw new Error("Cannot add shots to a regular a-roll scene. Only a-roll-multi and b-roll/visual scenes support shots.");
    }

    if (!bRollShots?.length) {
      throw new Error("bRollShots array is required for b-roll/visual scenes.");
    }
    if (arollShots?.length) {
      throw new Error("Cannot add arollShots to a b-roll/visual scene. Use bRollShots instead.");
    }

    const existing = scene.bRollShots?.length || 0;
    if (existing + bRollShots.length > 5) {
      throw new Error(
        `Cannot add ${bRollShots.length} shots — scene already has ${existing} and max is 5.`,
      );
    }

    const generatedShots = await Promise.all(
      bRollShots.map(async (shot) => {
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
      message: `Added ${bRollShots.length} b-roll shot(s) to scene ${sceneNumber}. Total shots: ${scene.bRollShots.length}. Thumbnail regeneration recommended.`,
    };
  },
});
