import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "crypto";
import { ENV } from "../config/env";
import {
  generateUGCScriptPrompt,
  generateSceneRegenerationPrompt,
  UGCScriptPromptConfig,
} from "../config/ugcPrompts";
import {
  GenerateUGCScriptResponseSchema,
  UGCScript,
  UGCScene,
  UGCSceneSchema,
  ClientUGCScript,
} from "../types/ugcScript.types";
import { db } from "../db";
import { characters, ugcScripts } from "@clipper/shared-db";
import { eq } from "drizzle-orm";

const client = new OpenAI({
  apiKey: ENV.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 3,
});

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
}

export interface RegenerateSceneParams {
  scriptId: string;
  sceneId: string;
  currentDialogue: string;
  currentEmotion: string;
  regenerationType: "dialogue" | "full";
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
    };

    const prompt = generateUGCScriptPrompt(promptConfig);

    const imageContent = productImageUrls.map((url) => ({
      type: "input_image" as const,
      image_url: url,
      detail: "high" as const,
    }));

    const response = await client.responses.parse({
      model: "gpt-5.2",
      input: [
        {
          role: "user",
          content: [
            ...imageContent,
            { type: "input_text", text: prompt },
          ],
        },
      ],
      text: {
        format: zodTextFormat(GenerateUGCScriptResponseSchema, "ugc_script_response"),
      },
    });

    const parsed = response.output_parsed;
    if (!parsed) {
      throw new Error("Failed to parse script response");
    }
    const scripts = parsed.scripts || [];

    scripts.forEach((script) => {
      script.scenes.forEach((scene, idx) => {
        if (!scene.id) {
          scene.id = randomUUID();
        }
        scene.sceneNumber = idx + 1;
      });
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

    return parts.length > 0 ? parts.join(", ") : "No specific appearance details";
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

    console.log(`[UGC_SCRIPT] Stored scripts for team ${teamId}, scriptId: ${inserted.id}`);
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
      "the character"
    );

    const response = await client.responses.parse({
      model: "gpt-4o-mini",
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

  stripCinematicPrompts(script: UGCScript): ClientUGCScript {
    return {
      ...script,
      scenes: script.scenes.map(
        ({ cinematicPrompt, cameraDirection, ...scene }) => scene
      ),
    };
  }
}

export const ugcScriptService = new UGCScriptService();
