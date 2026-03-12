import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  generateUGCScriptPrompt,
  generateSceneRegenerationPrompt,
  generateAutoStructurePrompt,
  UGCScriptPromptConfig,
  SCRIPT_STRUCTURES,
} from "../../config/ugcPrompts";
import {
  GenerateUGCScriptResponseSchema,
  GenerateUGCScriptResponse,
  UGCScriptSchema,
  UGCSceneBaseSchema,
  UGCScript,
  UGCScene,
  UGCSceneSchema,
  BRollShotSchema,
  BRollShot,
  ClientUGCScript,
  SceneType,
  AutoStructureResponseSchema,
  AutoStructureResponse,
} from "../../types/ugcScript.types";
import { db } from "../../db";
import { characters, ugcScripts } from "@clipper/shared-db";
import { eq } from "drizzle-orm";
import { openaiClient } from "../openai.service";
import { s3Service } from "../s3.service";
import { config } from "../../config/env";

const client = openaiClient;
const MAX_AROLL_MERGE_COUNT = 2;

export const SILENT_TEMPLATE_IDS = new Set([
  "silent-before-after",
  "silent-showcase",
  "silent-montage",
]);

/** Detect whether a script is silent based on structure ID and/or custom pattern */
export function detectSilentMode(
  structureId: string,
  customPattern?: { type: string; shot: string }[] | null,
): boolean {
  if (SILENT_TEMPLATE_IDS.has(structureId)) return true;
  if (structureId === "custom" && customPattern?.length) {
    return customPattern.every((s) => s.shot === "visual");
  }
  return false;
}

/**
 * Builds a dynamic Zod schema that enforces the selected structure at the
 * output-parsing level — exact scene count, locked shot types for all-silent
 * or all-a-roll templates, and empty dialogue for visual scenes.
 */
export function buildDynamicResponseSchema(
  structureId: string,
  customPattern?: { type: string; shot: string }[],
  forceSilent?: boolean,
) {
  let sceneCount: number | null = null;
  const isSilent = forceSilent || detectSilentMode(structureId, customPattern);
  let singleShotType: "a-roll" | "b-roll" | null = null;

  if (structureId === "custom" && customPattern?.length) {
    sceneCount = customPattern.length;
    // Map "visual" → "b-roll" for shot type analysis
    const mappedShots = new Set(
      customPattern.map((s) => (s.shot === "visual" ? "b-roll" : s.shot)),
    );
    if (mappedShots.size === 1) {
      singleShotType = [...mappedShots][0] as "a-roll" | "b-roll";
    }
  } else if (SCRIPT_STRUCTURES[structureId]) {
    const pattern = SCRIPT_STRUCTURES[structureId].pattern;
    if (pattern.length > 0) {
      sceneCount = pattern.length;
      const shotTypes = new Set(pattern.map((s) => s.shot));
      if (shotTypes.size === 1) {
        singleShotType = [...shotTypes][0] as "a-roll" | "b-roll";
      }
    }
  }

  // No pattern info → fall back to generic schema
  if (sceneCount === null) {
    return GenerateUGCScriptResponseSchema;
  }

  // Derive constrained scene schema from base — only override dynamic fields
  const sceneSchema = isSilent
    ? UGCSceneBaseSchema.omit({ shotType: true, dialogue: true, ambientSound: true }).extend({
        shotType: z.literal("b-roll" as const).describe("Must be b-roll — visual/silent scene, no audio"),
        dialogue: z.literal("" as const).describe("Must be empty — silent visual scene"),
        ambientSound: z.null().describe("Must be null — silent visual scene"),
      })
    : singleShotType
      ? UGCSceneBaseSchema.omit({ shotType: true }).extend({
          shotType: z.literal(singleShotType).describe(`Must be ${singleShotType} for this structure`),
        })
      : UGCSceneBaseSchema;

  // Derive script schema — only override scenes array with exact length
  const scriptSchema = UGCScriptSchema.omit({ scenes: true }).extend({
    scenes: z.array(sceneSchema).length(sceneCount).describe(`EXACTLY ${sceneCount} scenes required`),
  });

  return z.object({
    scripts: z.array(scriptSchema).min(1).max(3).describe("Array of script variations"),
  });
}

/**
 * Merges consecutive a-roll scenes in the lightweight init structure format.
 * When 2 a-roll scenes are back-to-back, they become one smooth a-roll scene —
 * the actor delivers both beats in a single take for better flow.
 */
export function mergeConsecutiveArollStructure(
  structure: Array<{ sceneType: string; slug: string; description: string }>,
): Array<{ sceneType: string; slug: string; description: string }> {
  if (structure.length === 0) return structure;

  const merged: Array<{ sceneType: string; slug: string; description: string }> = [];
  let i = 0;

  while (i < structure.length) {
    const current = structure[i];

    if (current.sceneType === "a-roll" && i + 1 < structure.length && structure[i + 1].sceneType === "a-roll") {
      const group = [current];
      let j = i + 1;
      while (j < structure.length && structure[j].sceneType === "a-roll" && group.length < MAX_AROLL_MERGE_COUNT) {
        group.push(structure[j]);
        j++;
      }

      merged.push({
        sceneType: "a-roll",
        slug: group.map((s) => s.slug).join(" + "),
        description: group[0].description,
      });
      i = j;
    } else {
      merged.push(current);
      i++;
    }
  }

  return merged;
}

export function mergeConsecutiveArollScenes(scenes: UGCScene[]): UGCScene[] {
  if (scenes.length === 0) return scenes;

  const merged: UGCScene[] = [];
  let i = 0;

  while (i < scenes.length) {
    const current = scenes[i];

    if (current.shotType === "a-roll" && i + 1 < scenes.length) {
      const consecutiveArolls: UGCScene[] = [current];
      let j = i + 1;

      while (
        j < scenes.length &&
        scenes[j].shotType === "a-roll" &&
        consecutiveArolls.length < MAX_AROLL_MERGE_COUNT
      ) {
        consecutiveArolls.push(scenes[j]);
        j++;
      }

      if (consecutiveArolls.length > 1) {
        const mergedTypes = consecutiveArolls.map(s => s.sceneType);
        const combinedDialogue = consecutiveArolls.map(s => s.dialogue).join(" ");
        const combinedDuration = consecutiveArolls.reduce((sum, s) => sum + s.estimatedDurationSeconds, 0);
        const combinedAction = consecutiveArolls.map(s => s.action).join(" Then, ");
        const combinedCinematic = consecutiveArolls.map(s => s.cinematicPrompt).join("\n\n");

        merged.push({
          id: current.id,
          sceneNumber: merged.length + 1,
          sceneType: current.sceneType,
          action: combinedAction,
          dialogue: combinedDialogue,
          emotion: current.emotion,
          estimatedDurationSeconds: combinedDuration,
          shotType: "a-roll",
          cameraAngle: current.cameraAngle,
          cinematicPrompt: combinedCinematic,
          ambientSound: current.ambientSound,
          bRollShots: null,
          mergedSceneTypes: mergedTypes as SceneType[],
        });

        i = j;
      } else {
        merged.push({ ...current, sceneNumber: merged.length + 1 });
        i++;
      }
    } else {
      merged.push({ ...current, sceneNumber: merged.length + 1 });
      i++;
    }
  }

  return merged;
}

export interface GenerateScriptsParams {
  productImageUrls: string[];
  productName?: string;
  productDescription?: string;
  scriptDirection?: string;
  character: {
    id: number;
    name: string;
    gender: string | null;
    age_range: string | null;
    appearance_config: any;
  };
  targetDuration?: number;
  numberOfVariations?: number;
  structureId?: string;
  customPattern?: { type: string; shot: string }[];
  isSilent?: boolean;
}

export interface RegenerateSceneParams {
  scriptId: string;
  sceneId: string;
  currentDialogue: string;
  currentEmotion: string;
  regenerationType: "dialogue" | "full";
  customPrompt?: string;
}

export interface RegenerateBRollPromptParams {
  scriptId: string;
  sceneId: string;
  bRollShotIndex: number;
  newAction: string;
}

class UGCScriptService {
  async getCharacterById(characterId: number) {
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);
    return character;
  }

  async generateScripts(params: GenerateScriptsParams): Promise<UGCScript[]> {
    const {
      productImageUrls,
      productName,
      productDescription,
      scriptDirection,
      character,
      targetDuration = 30,
      numberOfVariations = 2,
      structureId = "classic",
      customPattern,
      isSilent: forceSilent,
    } = params;

    const imageDescriptions = await this.analyzeProductImages(productImageUrls);

    const appearanceDesc = this.formatAppearanceConfig(
      character.appearance_config
    );

    const promptConfig: UGCScriptPromptConfig = {
      productName,
      productDescription,
      productImageDescriptions: imageDescriptions,
      characterName: character.name,
      characterGender: character.gender || "unspecified",
      characterAgeRange: character.age_range || "25-35",
      characterAppearance: appearanceDesc,
      scriptDirection,
      targetDuration,
      numberOfVariations,
      structureId,
      customPattern,
      isSilent: forceSilent,
    };

    const prompt = generateUGCScriptPrompt(promptConfig);

    const imageContent = productImageUrls.map((url) => ({
      type: "input_image" as const,
      image_url: url,
      detail: "high" as const,
    }));

    const responseSchema = buildDynamicResponseSchema(
      structureId,
      customPattern,
      forceSilent,
    );

    const response = await client.responses.parse({
      model: "gpt-5.2",
      input: [
        {
          role: "user",
          content: [...imageContent, { type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: zodTextFormat(
          responseSchema as any,
          "ugc_script_response"
        ),
      },
    });

    const parsed = response.output_parsed as GenerateUGCScriptResponse | null;
    if (!parsed) {
      throw new Error("Failed to parse script response");
    }
    const scripts = parsed.scripts || [];

    scripts.forEach((script) => {
      script.scenes.forEach((scene) => {
        if (!scene.id) {
          scene.id = randomUUID();
        }
        // A-roll scenes must never have bRollShots — strip if AI mistakenly added them
        if (scene.shotType === "a-roll" && scene.bRollShots) {
          console.warn(`[UGC Script] Stripping bRollShots from a-roll scene ${scene.sceneNumber} (${scene.sceneType})`);
          scene.bRollShots = null;
        }
      });
      script.scenes = mergeConsecutiveArollScenes(script.scenes);
    });

    return scripts;
  }

  private async analyzeProductImages(imageUrls: string[]): Promise<string[]> {
    const imageContent = imageUrls.map((url) => ({
      type: "input_image" as const,
      image_url: url,
      detail: "low" as const,
    }));

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "input_text",
              text: `Analyze these product images. For each image, provide a brief description (1-2 sentences) covering:
- What the product is
- Key visual features
- Any text/branding visible
- The setting/context

Return a JSON object with a "descriptions" array of strings, one description per image.`,
            },
          ],
        },
      ],
      text: { format: { type: "json_object" } },
    });

    try {
      const parsed = JSON.parse(response.output_text || "{}");
      return parsed.descriptions || imageUrls.map(() => "Product image");
    } catch {
      return imageUrls.map(() => "Product image");
    }
  }

  private formatAppearanceConfig(config: any): string {
    if (!config) return "No specific appearance details";

    const parts: string[] = [];

    if (config.hairColor) parts.push(`${config.hairColor} hair`);
    if (config.hairStyle) parts.push(`${config.hairStyle} hairstyle`);
    if (config.skinTone) parts.push(`${config.skinTone} skin tone`);
    if (config.eyeColor) parts.push(`${config.eyeColor} eyes`);
    if (config.bodyType) parts.push(`${config.bodyType} build`);

    return parts.length > 0
      ? parts.join(", ")
      : "No specific appearance details";
  }

  async storeFullScripts(
    teamId: number,
    characterId: number,
    productImageKeys: string[],
    productName: string | undefined,
    scriptDirection: string | undefined,
    scripts: UGCScript[]
  ): Promise<string> {
    const [inserted] = await db
      .insert(ugcScripts)
      .values({
        team_id: teamId,
        character_id: characterId,
        product_image_keys: productImageKeys,
        product_name: productName || null,
        script_direction: scriptDirection || null,
        scripts_data: scripts,
        selected_variant_index: 0,
        status: "completed",
      })
      .returning({ id: ugcScripts.id });

    console.log(
      `[UGC_SCRIPT] Stored scripts for team ${teamId}, scriptId: ${inserted.id}`
    );
    return inserted.id;
  }

  async getFullScript(scriptId: string): Promise<{
    scripts: UGCScript[];
    selectedVariantIndex: number;
    characterId: number | null;
  } | null> {
    const [script] = await db
      .select()
      .from(ugcScripts)
      .where(eq(ugcScripts.id, scriptId))
      .limit(1);

    if (!script) return null;

    return {
      scripts: script.scripts_data as UGCScript[],
      selectedVariantIndex: script.selected_variant_index || 0,
      characterId: script.character_id,
    };
  }

  async updateScript(
    scriptId: string,
    updates: { scenes?: UGCScene[]; selectedVariantIndex?: number }
  ): Promise<{ scripts: UGCScript[]; selectedVariantIndex: number } | null> {
    const existing = await this.getFullScript(scriptId);
    if (!existing) return null;

    const { scripts, selectedVariantIndex } = existing;
    let newSelectedIndex = selectedVariantIndex;

    if (updates.selectedVariantIndex !== undefined) {
      newSelectedIndex = updates.selectedVariantIndex;
    }

    if (updates.scenes && scripts[newSelectedIndex]) {
      scripts[newSelectedIndex].scenes = updates.scenes;
    }

    await db
      .update(ugcScripts)
      .set({
        scripts_data: scripts,
        selected_variant_index: newSelectedIndex,
        updated_at: new Date(),
      })
      .where(eq(ugcScripts.id, scriptId));

    return { scripts, selectedVariantIndex: newSelectedIndex };
  }

  async regenerateScene(params: RegenerateSceneParams): Promise<UGCScene> {
    const { scriptId, sceneId, currentDialogue, currentEmotion } = params;

    const existing = await this.getFullScript(scriptId);
    if (!existing) {
      throw new Error("Script not found");
    }

    const { scripts, selectedVariantIndex } = existing;
    const currentScript = scripts[selectedVariantIndex];
    const sceneIndex = currentScript.scenes.findIndex((s) => s.id === sceneId);
    if (sceneIndex === -1) {
      throw new Error("Scene not found");
    }

    const currentScene = currentScript.scenes[sceneIndex];

    const prompt = generateSceneRegenerationPrompt(
      currentScene.sceneType,
      currentDialogue,
      currentEmotion,
      currentScript.title,
      "the character",
      currentScene.shotType,
      params.customPrompt
    );

    const response = await client.responses.parse({
      model: "gpt-5-mini",
      input: [{ role: "user", content: prompt }],
      text: {
        format: zodTextFormat(UGCSceneSchema, "regenerated_scene"),
      },
    });

    const newScene = response.output_parsed;
    if (!newScene) {
      throw new Error("Failed to regenerate scene");
    }

    newScene.id = sceneId;
    newScene.sceneNumber = currentScene.sceneNumber;

    currentScript.scenes[sceneIndex] = newScene;

    await db
      .update(ugcScripts)
      .set({
        scripts_data: scripts,
        updated_at: new Date(),
      })
      .where(eq(ugcScripts.id, scriptId));

    return newScene;
  }

  async regenerateCinematicPrompt(action: string): Promise<string> {
    const prompt = `Generate a detailed cinematicPrompt for a video scene with this action: "${action}"

The cinematicPrompt should be 2-3 paragraphs describing:
1. Visual composition, lighting, and framing
2. Camera movement and timing
3. Technical style and what to avoid

Keep it professional and suitable for AI video generation. Return ONLY the cinematicPrompt text, no JSON or extra formatting.`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [{ role: "user", content: prompt }],
    });

    return response.output_text?.trim() || action;
  }

  async regenerateBRollPrompt(params: RegenerateBRollPromptParams): Promise<string> {
    const { scriptId, sceneId, bRollShotIndex, newAction } = params;

    const existing = await this.getFullScript(scriptId);
    if (!existing) {
      throw new Error("Script not found");
    }

    const { scripts, selectedVariantIndex } = existing;
    const currentScript = scripts[selectedVariantIndex];
    const scene = currentScript.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }

    if (!scene.bRollShots || !scene.bRollShots[bRollShotIndex]) {
      throw new Error("B-roll shot not found");
    }

    const BRollRegenSchema = z.object({
      cinematicPrompt: z.string().describe("Detailed cinematic description (2-3 sentences) for AI image generation describing composition, lighting, and framing. No text/caption mentions."),
      shotType: z.enum(["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"]).describe("CHARACTER = person doing an action, PRODUCT = product-only/environment with NO person, CHARACTER_AND_PRODUCT = person interacting with the product"),
    });

    const prompt = `Generate a cinematicPrompt and classify the shotType for a B-roll shot with this action: "${newAction}"

cinematicPrompt: 2-3 sentences describing visual composition, lighting, and framing. Professional and suitable for AI image generation.

shotType: Classify what this shot features:
- "CHARACTER" — a person doing an action (e.g., "she stands tall", "woman stretching")
- "PRODUCT" — product-only or environment shot with NO person (e.g., "bottle on counter")
- "CHARACTER_AND_PRODUCT" — person interacting with the product (e.g., "she applies the serum")`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [{ role: "user", content: prompt }],
      text: { format: zodTextFormat(BRollRegenSchema, "b_roll_regen") },
    });

    const parsed = BRollRegenSchema.parse(JSON.parse(response.output_text));

    scene.bRollShots[bRollShotIndex].action = newAction;
    scene.bRollShots[bRollShotIndex].cinematicPrompt = parsed.cinematicPrompt;
    scene.bRollShots[bRollShotIndex].shotType = parsed.shotType;

    await db
      .update(ugcScripts)
      .set({
        scripts_data: scripts,
        updated_at: new Date(),
      })
      .where(eq(ugcScripts.id, scriptId));

    return parsed.cinematicPrompt;
  }

  async regenerateAllBRollShots(params: {
    scriptId: string;
    sceneId: string;
    newSceneAction: string;
    shotCount: number;
    shotDurations: number[];
  }): Promise<BRollShot[]> {
    const { scriptId, sceneId, newSceneAction, shotCount, shotDurations } = params;

    const existing = await this.getFullScript(scriptId);
    if (!existing) {
      throw new Error("Script not found");
    }

    const { scripts, selectedVariantIndex } = existing;
    const currentScript = scripts[selectedVariantIndex];
    const scene = currentScript.scenes.find((s) => s.id === sceneId);
    if (!scene || !scene.bRollShots) {
      throw new Error("Scene or B-roll shots not found");
    }

    const ShotsResponseSchema = z.object({
      shots: z.array(BRollShotSchema).length(shotCount),
    });

    const prompt = `You are generating ${shotCount} B-roll shot descriptions for a product demo scene.

Scene action: "${newSceneAction}"

Generate exactly ${shotCount} shots that break down this scene action into individual camera shots.
Each shot should have:
- "action": A single, specific camera action (1-2 sentences). Describe what the hands/camera do. NEVER mention on-screen text, captions, or graphics.
- "cinematicPrompt": A detailed cinematic description (2-3 sentences) for AI image generation describing composition, lighting, and framing.
- "durationSeconds": Use these durations in order: [${shotDurations.join(", ")}]
- "productImageNeeded": true if the shot shows the product, false for lifestyle/mood shots.
- "shotType": Classify what this shot features:
  * "CHARACTER" — a person doing an action (e.g., "she stands tall", "woman stretching")
  * "PRODUCT" — product-only or environment shot with NO person (e.g., "bottle on counter")
  * "CHARACTER_AND_PRODUCT" — person interacting with the product (e.g., "she applies the serum")

Return a JSON object with a "shots" array of exactly ${shotCount} shot objects.`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [{ role: "user", content: prompt }],
      text: { format: zodTextFormat(ShotsResponseSchema, "b_roll_shots") },
    });

    const parsed = JSON.parse(response.output_text);
    const newShots: BRollShot[] = ShotsResponseSchema.parse(parsed).shots;

    // Update scene in-memory
    scene.bRollShots = newShots;

    // Persist to database
    await db
      .update(ugcScripts)
      .set({
        scripts_data: scripts,
        updated_at: new Date(),
      })
      .where(eq(ugcScripts.id, scriptId));

    return newShots;
  }

  async generateAutoStructure(params: {
    scriptDirection: string;
    productName?: string;
    hasProductImages?: boolean;
  }): Promise<AutoStructureResponse> {
    const { scriptDirection, productName, hasProductImages } = params;

    const prompt = generateAutoStructurePrompt(scriptDirection, productName, hasProductImages);

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [{ role: "user", content: prompt }],
      text: {
        format: zodTextFormat(AutoStructureResponseSchema, "auto_structure"),
      },
    });

    return AutoStructureResponseSchema.parse(JSON.parse(response.output_text));
  }

  async initStructure(params: {
    message: string;
    productImageKeys?: string[];
    threadId?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }) {
    const { message, productImageKeys, threadId, conversationHistory } = params;

    // Build multimodal message content parts for the current message
    const content: Array<{ type: string; text?: string; image?: string; mediaType?: string }> = [
      { type: "text", text: message },
    ];

    if (productImageKeys?.length) {
      const presignedUrls = await Promise.all(
        productImageKeys.map((key) => s3Service.getPresignedUrl(key)),
      );
      for (const url of presignedUrls) {
        content.push({ type: "image", image: url, mediaType: "image/jpeg" });
      }
    }

    // Build full messages array: conversation history + current message
    const messages: Array<{ role: string; content: unknown }> = [];
    if (conversationHistory?.length) {
      // Add all previous messages (text-only) for context
      for (const msg of conversationHistory.slice(0, -1)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    // Current message with multimodal content (images)
    messages.push({ role: "user", content });

    const agentServiceUrl = config.agentService.url;
    const requestBody: Record<string, unknown> = { messages };

    // Pass threadId for Mastra memory persistence
    if (threadId) {
      requestBody.memory = {
        thread: threadId,
        resource: "ugc-chat",
      };
    }

    const response = await fetch(
      `${agentServiceUrl}/api/agents/script-init-agent/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[UGC_SCRIPT] Agent service error:", errorBody);
      throw new Error("Failed to generate init structure from agent service");
    }

    const result = (await response.json()) as Record<string, unknown>;
    const agentResult = (result.object ?? result) as {
      responseType: "conversation" | "structure";
      message: string;
      isSilent: boolean;
      character: boolean;
      videoType: string;
      structure: Array<{ sceneType: string; slug: string; description: string }>;
    };

    // If it's a structure response with scenes, merge consecutive a-roll scenes
    if (agentResult.responseType === "structure" && agentResult.structure?.length) {
      agentResult.structure = mergeConsecutiveArollStructure(agentResult.structure);
    }

    return agentResult;
  }

  stripCinematicPrompts(script: UGCScript): ClientUGCScript {
    return {
      ...script,
      scenes: script.scenes.map(
        ({ cinematicPrompt, ...scene }) => scene
      ),
    };
  }
}

export const ugcScriptService = new UGCScriptService();
