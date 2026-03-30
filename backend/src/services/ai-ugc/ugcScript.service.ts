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
import { characters, ugcScripts, sceneImageGenerationJobs } from "@clipper/shared-db";
import { eq, and, sql } from "drizzle-orm";
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
        consecutiveArolls.length < MAX_AROLL_MERGE_COUNT &&
        (scenes[j] as any).characterIndex === (current as any).characterIndex
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

  private static ELEVENLABS_TO_EMOTION: Record<string, string> = {
    whispering: "sincere",
    laughing: "playful",
    satisfied: "relieved",
    dramatic: "urgent",
  };

  private extractEmotionFromDialogue(dialogue: string | undefined): string | null {
    if (!dialogue) return null;
    const match = dialogue.match(/\[([a-z]+)\]/i);
    if (!match) return null;
    const tag = match[1].toLowerCase();
    return UGCScriptService.ELEVENLABS_TO_EMOTION[tag] || tag;
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

  async getFullScript(scriptId: string): Promise<{
    scripts: UGCScript[];
    selectedVariantIndex: number;
    characterId: number | null;
    isSilent: boolean;
    hasCharacter: boolean;
    videoType: string;
    charactersConfig: Array<{ characterId: number; voiceId: string | null }> | null;
    characterCount: number;
  } | null> {
    const [script] = await db
      .select()
      .from(ugcScripts)
      .where(eq(ugcScripts.id, scriptId))
      .limit(1);

    if (!script) return null;

    const charactersConfig = script.characters_config as Array<{ characterId: number; voiceId: string | null }> | null;
    const characterCount = charactersConfig?.length || (script.has_character ? 1 : 0);

    return {
      scripts: script.scripts_data as UGCScript[],
      selectedVariantIndex: script.selected_variant_index || 0,
      characterId: script.character_id,
      isSilent: script.is_silent,
      hasCharacter: script.has_character,
      videoType: script.video_type,
      charactersConfig,
      characterCount,
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

    scene.bRollShots = newShots;

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

    const url = `${agentServiceUrl}/api/agents/script-init-agent/generate`;
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120_000),
    };

    let response!: globalThis.Response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(url, fetchOptions);
        if (response.ok) break;

        const errorBody = await response.text();
        const isGatewayError = response.status === 502 || response.status === 503 || response.status === 504;
        if (!isGatewayError || attempt === 1) {
          console.error("[UGC_SCRIPT] Agent service error:", errorBody);
          throw new Error("Failed to generate init structure from agent service");
        }
        console.warn(`[UGC_SCRIPT] Init agent returned ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        if (err instanceof Error && err.message === "Failed to generate init structure from agent service") throw err;
        if (attempt === 1) {
          console.error("[UGC_SCRIPT] Init agent fetch error:", err);
          throw new Error("Failed to generate init structure from agent service");
        }
        console.warn("[UGC_SCRIPT] Init agent fetch failed, retrying...", err);
        await new Promise((r) => setTimeout(r, 3000));
      }
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

  async generateScriptViaAgent(params: {
    teamId: number;
    characterId?: number;
    characters?: Array<{ characterId: number; character: { name: string; gender: string | null; age_range: string | null; appearance_config: any }; voiceId?: string }>;
    structure: Array<{ sceneType: string; slug: string; description: string; characterIndex?: number; shots?: Array<{ label: string; shotType: string }> }>;
    character?: { name: string; gender: string | null; age_range: string | null; appearance_config: any } | null;
    voice?: { name: string; style?: string } | null;
    targetAudience: string;
    productImageKeys?: string[];
    userDirection?: string;
    isSilent: boolean;
    videoType: string;
  }): Promise<{ scriptId: string; script: any }> {
    const {
      teamId,
      characterId,
      characters,
      structure,
      character,
      voice,
      targetAudience,
      productImageKeys,
      userDirection,
      isSilent,
      videoType,
    } = params;

    // Build multimodal content parts for product images
    const content: Array<{ type: string; text?: string; image?: string; mediaType?: string }> = [];

    if (productImageKeys?.length) {
      const presignedUrls = await Promise.all(
        productImageKeys.map((key) => s3Service.getPresignedUrl(key)),
      );
      for (const url of presignedUrls) {
        content.push({ type: "image", image: url, mediaType: "image/jpeg" });
      }
    }

    // Build structured text summary for the agent
    const structureSummary = structure
      .map((s, i) => {
        const shots = s.shots?.length
          ? ` | Shots: ${s.shots.map((sh) => `${sh.label} (${sh.shotType})`).join(", ")}`
          : "";
        const charIdx = s.characterIndex !== undefined ? ` | characterIndex=${s.characterIndex}` : "";
        return `  ${i + 1}. ${s.slug} (${s.sceneType}) — ${s.description}${charIdx}${shots}`;
      })
      .join("\n");

    let characterSummary: string;
    if (characters && characters.length > 1) {
      characterSummary = `Characters (${characters.length}):\n` + characters
        .map((c, i) => `  [${i}] ${c.character.name}, ${c.character.gender || "unspecified"}, ${c.character.age_range || "25-35"}, ${this.formatAppearanceConfig(c.character.appearance_config)}`)
        .join("\n");
    } else if (character) {
      characterSummary = `Character: ${character.name}, ${character.gender || "unspecified"}, ${character.age_range || "25-35"}, ${this.formatAppearanceConfig(character.appearance_config)}`;
    } else {
      characterSummary = "No character (product-only video)";
    }

    const voiceSummary = voice
      ? `Voice: ${voice.name}${voice.style ? ` (${voice.style})` : ""}`
      : "No voice (silent video)";

    const messageText = [
      `=== VIDEO SCRIPT GENERATION ===`,
      `Video Type: ${videoType}`,
      `Silent: ${isSilent}`,
      `Target Audience: ${targetAudience}`,
      ``,
      `${characterSummary}`,
      `${voiceSummary}`,
      ``,
      `Structure Blueprint:`,
      structureSummary,
      ``,
      userDirection ? `User Direction: ${userDirection}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    content.push({ type: "text", text: messageText });

    const messages = [{ role: "user", content }];

    const agentServiceUrl = config.agentService.url;
    const url = `${agentServiceUrl}/api/agents/script-agent/generate`;
    const fetchOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(270_000),
    };

    let response!: globalThis.Response;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(url, fetchOptions);
        if (response.ok) break;

        const errorBody = await response.text();
        const isGatewayError = response.status === 502 || response.status === 503 || response.status === 504;
        if (!isGatewayError || attempt === 1) {
          console.error("[UGC_SCRIPT] Script agent error:", errorBody);
          throw new Error("Failed to generate script from agent service");
        }
        console.warn(`[UGC_SCRIPT] Agent returned ${response.status}, retrying (attempt ${attempt + 1})...`);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        lastError = err;
        if (err instanceof Error && err.message === "Failed to generate script from agent service") throw err;
        if (attempt === 1) {
          console.error("[UGC_SCRIPT] Script agent fetch error:", err);
          throw new Error("Failed to generate script from agent service");
        }
        console.warn(`[UGC_SCRIPT] Agent fetch failed, retrying (attempt ${attempt + 1})...`, err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    const result = (await response.json()) as Record<string, unknown>;
    const agentResult = (result.object ?? result) as any;

    // Normalize agent output to the backend UGCScript schema.
    // The agent returns fields like: slug, storyBeat, duration, shots[], sceneType (a-roll/b-roll/visual)
    // The backend expects:         id, sceneType (story beat), estimatedDurationSeconds, bRollShots[], shotType (a-roll/b-roll)
    const normalizedScript = {
      title: agentResult.title,
      hook: agentResult.scenes?.[0]?.dialogue || "",
      targetAudience: agentResult.targetAudience,
      totalEstimatedDuration: agentResult.totalDuration,
      scenes: (agentResult.scenes || []).map((scene: any) => ({
        id: scene.id || scene.slug || `scene-${scene.sceneNumber}`,
        sceneNumber: scene.sceneNumber,
        // Agent's storyBeat → backend's sceneType (hook, problem, demo, etc.)
        sceneType: scene.storyBeat || scene.sceneType || "demo",
        action: scene.action,
        dialogue: scene.dialogue || "",
        emotion: this.extractEmotionFromDialogue(scene.dialogue) || "confident",
        // Agent's duration → backend's estimatedDurationSeconds
        estimatedDurationSeconds: scene.duration || scene.estimatedDurationSeconds || 5,
        // Agent's sceneType (a-roll/a-roll-multi/b-roll/visual) → backend's shotType
        // a-roll-multi is ONLY allowed for podcast videoType; downgrade to a-roll otherwise
        shotType: scene.sceneType === "a-roll" ? "a-roll"
          : scene.sceneType === "a-roll-multi" && videoType === "podcast" ? "a-roll-multi"
          : scene.sceneType === "a-roll-multi" ? "a-roll"
          : "b-roll",
        cameraAngle: scene.cameraAngle || "medium-shot",
        cinematicPrompt: scene.cinematicPrompt || "",
        ambientSound: scene.ambientSound || null,
        characterIndex: scene.characterIndex ?? undefined,
        arollShots: videoType === "podcast" && scene.arollShots && scene.arollShots.length > 0
          ? scene.arollShots.map((shot: any) => ({
              dialogue: shot.dialogue,
              action: shot.action,
              imageGenPrompt: shot.imageGenPrompt || "",
              emotion: this.extractEmotionFromDialogue(shot.dialogue) || "confident",
              characterIndex: shot.characterIndex,
              ambientSound: shot.ambientSound ?? null,
              cinematicPrompt: shot.cinematicPrompt || "",
            }))
          : null,
        // Agent's shots[] → backend's bRollShots[]
        bRollShots: scene.shots && scene.shots.length > 0
          ? scene.shots.map((shot: any) => ({
              action: shot.action,
              cinematicPrompt: shot.cinematicPrompt,
              durationSeconds: shot.durationSeconds,
              productImageNeeded: shot.productImageNeeded ?? false,
              shotType: shot.shotType || "PRODUCT",
              characterIndex: shot.characterIndex ?? undefined,
            }))
          : null,
      })),
      viralScore: 0,
      viralReasoning: "",
      productMentions: [],
    };

    const scriptsData = [normalizedScript];
    const effectiveCharacterId = characters?.length ? characters[0].characterId : characterId;
    const insertValues: Record<string, unknown> = {
      team_id: teamId,
      product_image_keys: productImageKeys || [],
      script_direction: userDirection || null,
      scripts_data: scriptsData,
      selected_variant_index: 0,
      status: "completed",
      is_silent: isSilent,
      has_character: !!effectiveCharacterId,
      video_type: videoType || "ugc",
    };
    if (effectiveCharacterId) {
      insertValues.character_id = effectiveCharacterId;
    }
    if (characters && characters.length > 1) {
      insertValues.characters_config = characters.map((c) => ({
        characterId: c.characterId,
        voiceId: c.voiceId || null,
      }));
    }
    const [inserted] = await db
      .insert(ugcScripts)
      .values(insertValues as any)
      .returning({ id: ugcScripts.id });

    console.log(
      `[UGC_SCRIPT] Agent script stored for team ${teamId}, scriptId: ${inserted.id}`,
    );

    return { scriptId: inserted.id, script: normalizedScript };
  }

  async storyboardChat(params: {
    scriptId: string;
    message: string;
    threadId?: string;
    teamId?: number;
    characterId?: number;
  }): Promise<{
    message: string;
    updatedScript: any;
    regeneratingJobs: Array<{
      jobId: string;
      sceneId: string;
      sceneNumber: number;
      status: string;
      singleBRollShotIndex?: number;
    }>;
  }> {
    const { scriptId, message, threadId, teamId, characterId } = params;

    // Load current script to inject as context
    const existing = await this.getFullScript(scriptId);
    if (!existing) {
      throw new Error("Script not found");
    }

    const { scripts, selectedVariantIndex } = existing;
    const currentScript = scripts[selectedVariantIndex];

    // Build detailed script summary for the agent (includes b-roll shot details)
    const sceneSummary = currentScript.scenes
      .map((s) => {
        const dialoguePreview = s.dialogue
          ? `\n    Dialogue: "${s.dialogue.slice(0, 120)}${s.dialogue.length > 120 ? "..." : ""}"`
          : "";
        const actionPreview = s.action
          ? `\n    Action: ${s.action.slice(0, 120)}${s.action.length > 120 ? "..." : ""}`
          : "";
        let shotDetails = "";
        if (s.bRollShots?.length) {
          shotDetails = `\n    B-Roll Shots (${s.bRollShots.length}):` +
            s.bRollShots
              .map(
                (shot, i) =>
                  `\n      Shot ${i + 1}: ${shot.action.slice(0, 80)}${shot.action.length > 80 ? "..." : ""} (${shot.durationSeconds}s)`,
              )
              .join("");
        }
        if ((s as any).arollShots?.length) {
          const aShots = (s as any).arollShots as Array<{ dialogue: string; action: string; characterIndex: number }>;
          shotDetails += `\n    A-Roll Shots (${aShots.length} conversation turns):` +
            aShots
              .map(
                (shot, i) =>
                  `\n      Turn ${i + 1} [char ${shot.characterIndex}]: "${shot.dialogue?.slice(0, 80) || shot.action.slice(0, 80)}${(shot.dialogue || shot.action).length > 80 ? "..." : ""}"`,
              )
              .join("");
        }
        return `  ${s.sceneNumber}. [id:${s.id}] ${s.sceneType} (${s.shotType}, ${s.estimatedDurationSeconds}s, emotion: ${s.emotion})${actionPreview}${dialoguePreview}${shotDetails}`;
      })
      .join("\n");

    const contextMessage = `=== CURRENT SCRIPT CONTEXT ===
scriptId: ${scriptId}
variantIndex: ${selectedVariantIndex}
teamId: ${teamId || "unknown"}
characterId: ${characterId || existing.characterId || "unknown"}
Title: ${currentScript.title}
Target Audience: ${currentScript.targetAudience}
Total Duration: ${currentScript.totalEstimatedDuration}s
Scenes (${currentScript.scenes.length}):
${sceneSummary}

=== USER REQUEST ===
${message}`;

    const messages = [{ role: "user", content: contextMessage }];

    const agentServiceUrl = config.agentService.url;
    const requestBody: Record<string, unknown> = { messages };

    // Use a storyboard-scoped thread ID to avoid collision with init-agent threads.
    // Prefix the provided threadId (or scriptId) so Mastra creates a separate thread.
    const storyboardThreadId = threadId
      ? `storyboard-${threadId}`
      : `storyboard-${scriptId}`;
    requestBody.memory = {
      thread: storyboardThreadId,
      resource: "storyboard-chat",
    };

    const storyboardUrl = `${agentServiceUrl}/api/agents/storyboard-agent/generate`;
    const storyboardFetchOptions: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(270_000),
    };

    let response!: globalThis.Response;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(storyboardUrl, storyboardFetchOptions);
        if (response.ok) break;

        const errorBody = await response.text();
        const isGatewayError = response.status === 502 || response.status === 503 || response.status === 504;
        if (!isGatewayError || attempt === 1) {
          console.error("[UGC_SCRIPT] Storyboard agent error:", errorBody);
          throw new Error("Failed to process storyboard edit");
        }
        console.warn(`[UGC_SCRIPT] Storyboard agent returned ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        if (err instanceof Error && err.message === "Failed to process storyboard edit") throw err;
        if (attempt === 1) {
          console.error("[UGC_SCRIPT] Storyboard agent fetch error:", err);
          throw new Error("Failed to process storyboard edit");
        }
        console.warn("[UGC_SCRIPT] Storyboard agent fetch failed, retrying...", err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    const result = (await response.json()) as Record<string, unknown>;
    const agentMessage =
      typeof result.text === "string"
        ? result.text
        : typeof result.message === "string"
          ? result.message
          : "Changes applied.";

    // Re-read script from DB (tools already saved mutations)
    const updated = await this.getFullScript(scriptId);
    const updatedScript = updated
      ? updated.scripts[updated.selectedVariantIndex]
      : currentScript;

    // Check for any image generation jobs queued during this agent call
    // (created in the last 30 seconds for this script)
    const recentJobs = await db
      .select({
        id: sceneImageGenerationJobs.id,
        scene_id: sceneImageGenerationJobs.scene_id,
        scene_number: sceneImageGenerationJobs.scene_number,
        status: sceneImageGenerationJobs.status,
        progress_message: sceneImageGenerationJobs.progress_message,
      })
      .from(sceneImageGenerationJobs)
      .where(
        and(
          eq(sceneImageGenerationJobs.script_id, scriptId),
          sql`${sceneImageGenerationJobs.created_at} > NOW() - INTERVAL '30 seconds'`,
        ),
      );

    const regeneratingJobs = recentJobs.map((job) => {
      // Parse shot index from progress message (e.g., "Regenerating shot 2. Poll for status.")
      const shotMatch = job.progress_message?.match(/shot (\d+)/i);
      const shotIndex = shotMatch ? parseInt(shotMatch[1], 10) - 1 : undefined;
      return {
        jobId: job.id,
        sceneId: job.scene_id,
        sceneNumber: job.scene_number,
        status: job.status,
        singleBRollShotIndex: shotIndex,
      };
    });

    // Clean the agent message — remove job IDs and technical details
    const cleanMessage = agentMessage
      .replace(/\bjob\s*[Ii][Dd]:?\s*[a-f0-9-]{36}/g, "")
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/g, "")
      .replace(/\(index \d+\)/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      message: cleanMessage,
      updatedScript,
      regeneratingJobs,
    };
  }

  async deleteScript(scriptId: string, teamId: number): Promise<void> {
    const existing = await db
      .select({ id: ugcScripts.id })
      .from(ugcScripts)
      .where(
        and(eq(ugcScripts.id, scriptId), eq(ugcScripts.team_id, teamId))
      )
      .limit(1);

    if (existing.length === 0) {
      throw new Error("Script not found or does not belong to this team");
    }

    await db.delete(ugcScripts).where(eq(ugcScripts.id, scriptId));
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
