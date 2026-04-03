import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { loadScript, saveScript, estimateDurationFromDialogue } from "./shared.js";

export const changeDialogueTool = createTool({
  id: "change-dialogue",
  description:
    "Change the dialogue for a scene. For a-roll-multi (podcast) scenes, use arollShotDialogues to update individual character turns. For regular scenes, use newDialogue. Automatically recalculates duration. Dialogue must include ElevenLabs emotion tags like [excited], [sincere], etc.",
  inputSchema: z.object({
    scriptId: z.string().describe("The script UUID"),
    variantIndex: z.number().describe("Which script variant to edit (0-based)"),
    sceneNumber: z
      .number()
      .min(1)
      .describe("The scene number to modify (1-based)"),
    newDialogue: z
      .string()
      .optional()
      .describe(
        'New dialogue text with ElevenLabs emotion tags. Used for a-roll and b-roll scenes. Example: "[excited] Oh my god, you guys need to see this!"',
      ),
    arollShotDialogues: z
      .array(
        z.object({
          shotIndex: z.number().min(0).describe("Which arollShot to update (0-based)"),
          dialogue: z.string().describe("New dialogue with emotion tags for this shot"),
          action: z.string().optional().describe("Optional updated action for this shot"),
        }),
      )
      .optional()
      .describe("For a-roll-multi (podcast) scenes: update individual arollShot dialogues by index."),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    newDuration: z.number(),
    message: z.string(),
  }),
  execute: async ({ scriptId, variantIndex, sceneNumber, newDialogue, arollShotDialogues }) => {
    const { script, allScripts } = await loadScript(scriptId, variantIndex);

    const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);
    if (!scene) {
      throw new Error(`Scene ${sceneNumber} not found`);
    }

    if (scene.shotType === "a-roll-multi" && !scene.arollShots?.length) {
      throw new Error(
        `Scene ${sceneNumber} is a-roll-multi but has no arollShots. The scene data may be malformed.`,
      );
    }

    if (scene.shotType === "a-roll-multi" && scene.arollShots?.length) {
      if (!arollShotDialogues?.length && !newDialogue) {
        throw new Error(
          "For a-roll-multi scenes, provide arollShotDialogues to update individual character turns.",
        );
      }

      if (arollShotDialogues?.length) {
        for (const update of arollShotDialogues) {
          if (update.shotIndex < scene.arollShots.length) {
            const shot = scene.arollShots[update.shotIndex];
            shot.dialogue = update.dialogue;
            if (update.action) shot.action = update.action;
          } else {
            const emotionMatch = update.dialogue.match(/\[([a-z]+)\]/i);
            const prevShot = scene.arollShots[scene.arollShots.length - 1];
            const nextCharIndex = prevShot ? (prevShot.characterIndex === 0 ? 1 : 0) : 0;
            (scene.arollShots as any[]).push({
              dialogue: update.dialogue,
              action: update.action || "Speaking into podcast microphone",
              emotion: emotionMatch ? emotionMatch[1].toLowerCase() : "confident",
              characterIndex: nextCharIndex,
              ambientSound: null,
            });
          }
        }
      } else if (newDialogue) {
        scene.dialogue = newDialogue;
      }

      const totalDuration = scene.arollShots.reduce(
        (sum, shot) => sum + estimateDurationFromDialogue(shot.dialogue),
        0,
      );
      scene.estimatedDurationSeconds = totalDuration;
    } else {
      if (!newDialogue) {
        throw new Error("newDialogue is required for non-podcast scenes.");
      }

      if (scene.shotType === "b-roll" && (!scene.dialogue || scene.dialogue.trim() === "")) {
        // This was a silent b-roll, allow setting dialogue (converts to voiced b-roll)
      }

      scene.dialogue = newDialogue;
      scene.estimatedDurationSeconds = estimateDurationFromDialogue(newDialogue);
    }

    await saveScript(scriptId, variantIndex, script, allScripts);

    return {
      success: true,
      newDuration: scene.estimatedDurationSeconds,
      message: `Updated dialogue for scene ${sceneNumber}. Estimated duration: ${scene.estimatedDurationSeconds}s.`,
    };
  },
});
