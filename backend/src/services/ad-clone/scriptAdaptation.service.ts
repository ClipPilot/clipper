import { zodTextFormat } from "openai/helpers/zod";
import { randomUUID } from "crypto";
import { openaiClient } from "../openai.service";
import {
  generateScriptAdaptationPrompt,
  ScriptAdaptationConfig,
} from "../../config/adClonePrompts";
import { VideoAnalysis } from "../../types/adClone.types";
import { UGCScript, UGCScriptSchema } from "../../types/ugcScript.types";
import { s3Service } from "../s3.service";

const client = openaiClient;

export interface AdaptScriptParams {
  videoAnalysis: VideoAnalysis;
  productImageKeys: string[];
  productName: string;
  productDescription: string;
  character?: {
    id: number;
    name: string;
    gender: string | null;
    age_range: string | null;
    appearance_config: any;
  };
  adDirection?: string;
}

class ScriptAdaptationService {
  async adaptScript(params: AdaptScriptParams): Promise<UGCScript> {
    const {
      videoAnalysis,
      productImageKeys,
      productName,
      productDescription,
      character,
      adDirection,
    } = params;

    console.log("[ScriptAdaptation] Starting script adaptation...");
    console.log("  - Original video duration:", videoAnalysis.totalDuration);
    console.log("  - Scene count:", videoAnalysis.scenes.length);
    console.log("  - Product:", productName);

    const productImageUrls = await Promise.all(
      productImageKeys.map((key) => s3Service.getPresignedUrl(key, 3600))
    );

    const imageDescriptions = await this.analyzeProductImages(productImageUrls);

    const appearanceDesc = character
      ? this.formatAppearanceConfig(character.appearance_config)
      : "Will be determined when character is selected";

    const adaptationConfig: ScriptAdaptationConfig = {
      productName,
      productDescription,
      productImageDescriptions: imageDescriptions,
      characterName: character?.name || "The Presenter",
      characterGender: character?.gender || "unspecified",
      characterAgeRange: character?.age_range || "25-35",
      characterAppearance: appearanceDesc,
      adDirection,
      voiceDelivery: videoAnalysis.speakerPace ? {
        overallPace: videoAnalysis.speakerPace,
        overallEnergy: videoAnalysis.speakerEnergy,
        deliveryStyle: videoAnalysis.speakerStyle,
        estimatedWPM: videoAnalysis.speakerWPM,
        notableCharacteristics: videoAnalysis.speakerCharacteristics,
        recommendedTTSSpeed: videoAnalysis.recommendedTTSSpeed,
      } : undefined,
    };

    const systemPrompt = generateScriptAdaptationPrompt(adaptationConfig);

    const analysisContext = this.formatAnalysisForPrompt(videoAnalysis);

    const imageContent = productImageUrls.map((url) => ({
      type: "input_image" as const,
      image_url: url,
      detail: "high" as const,
    }));

    const response = await client.responses.parse({
      model: "gpt-5.2",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "input_text",
              text: `Here is the detailed analysis of the reference video to clone:\n\n${analysisContext}\n\nCreate an adapted UGCScript that faithfully recreates this video structure with the new product shown in the images above.`,
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(UGCScriptSchema, "adapted_ugc_script"),
      },
    });

    const adaptedScript = response.output_parsed;
    if (!adaptedScript) {
      throw new Error("Failed to parse adapted script response");
    }

    adaptedScript.scenes.forEach((scene, idx) => {
      if (!scene.id) {
        scene.id = randomUUID();
      }
      scene.sceneNumber = idx + 1;
    });

    console.log("[ScriptAdaptation] Adaptation complete:");
    console.log("  - Title:", adaptedScript.title);
    console.log("  - Scene count:", adaptedScript.scenes.length);
    console.log("  - Total duration:", adaptedScript.totalEstimatedDuration);

    return adaptedScript;
  }

  private formatAnalysisForPrompt(analysis: VideoAnalysis): string {
    const lines: string[] = [];

    lines.push("=== VIDEO OVERVIEW ===");
    lines.push(`Total Duration: ${analysis.totalDuration} seconds`);
    lines.push(`Aspect Ratio: ${analysis.aspectRatio}`);
    lines.push(`Overall Style: ${analysis.overallStyle}`);
    lines.push(`Pacing: ${analysis.pacing}`);
    lines.push(`Hook Strategy: ${analysis.hookStrategy}`);
    lines.push(`CTA Approach: ${analysis.ctaApproach}`);
    lines.push(`Target Demographic: ${analysis.targetDemographic}`);
    if (analysis.originalProductName) {
      lines.push(`Original Product: ${analysis.originalProductName}`);
    }
    if (analysis.originalProductCategory) {
      lines.push(`Product Category: ${analysis.originalProductCategory}`);
    }
    lines.push(`Narrative: ${analysis.overallNarrative}`);
    if (analysis.musicStyle) {
      lines.push(`Music Style: ${analysis.musicStyle}`);
    }
    lines.push("");

    if (analysis.speakerPace) {
      lines.push("=== VOICE DELIVERY ANALYSIS ===");
      lines.push(`Overall Pace: ${analysis.speakerPace}`);
      lines.push(`Overall Energy: ${analysis.speakerEnergy}`);
      lines.push(`Delivery Style: ${analysis.speakerStyle}`);
      lines.push(`Estimated WPM: ${analysis.speakerWPM}`);
      lines.push(`Recommended TTS Speed: ${analysis.recommendedTTSSpeed}x`);
      if (analysis.speakerCharacteristics?.length > 0) {
        lines.push(`Notable Characteristics: ${analysis.speakerCharacteristics.join(", ")}`);
      }
      lines.push("");
    }

    lines.push("=== KEY STRENGTHS ===");
    analysis.keyStrengths.forEach((strength, i) => {
      lines.push(`${i + 1}. ${strength}`);
    });
    lines.push("");

    lines.push("=== SCENE-BY-SCENE BREAKDOWN ===");
    analysis.scenes.forEach((scene) => {
      lines.push(`\n--- SCENE ${scene.sceneNumber} ---`);
      lines.push(`Time: ${scene.startTime}s - ${scene.endTime}s (${scene.durationSeconds}s)`);
      lines.push(`Type: ${scene.sceneType}`);
      lines.push(`Shot: ${scene.shotType}`);
      lines.push(`Camera: ${scene.cameraAngle}`);
      if (scene.cameraMovement) {
        lines.push(`Movement: ${scene.cameraMovement}`);
      }
      lines.push(`Emotion: ${scene.emotionalTone}`);
      if (scene.transcribedDialogue) {
        lines.push(`Dialogue: "${scene.transcribedDialogue}"`);
      }
      lines.push(`Action: ${scene.actionDescription}`);
      lines.push(`Setting: ${scene.settingDescription}`);
      if (scene.productMentions.length > 0) {
        lines.push(`Products: ${scene.productMentions.join(", ")}`);
      }
      if (scene.visualElements.length > 0) {
        lines.push(`Visuals: ${scene.visualElements.join(", ")}`);
      }
      if (scene.voicePace) {
        lines.push(`Voice Delivery: pace=${scene.voicePace}, energy=${scene.voiceEnergy}`);
        if (scene.voiceTags?.length > 0) {
          lines.push(`Voice Tags to Use: [${scene.voiceTags.join("], [")}]`);
        }
        if (scene.voicePausePattern) {
          lines.push(`Pause Pattern: ${scene.voicePausePattern}`);
        }
        if (scene.voiceEmphasis) {
          lines.push(`Emphasis: ${scene.voiceEmphasis}`);
        }
      }
    });

    return lines.join("\n");
  }

  private async analyzeProductImages(imageUrls: string[]): Promise<string[]> {
    if (imageUrls.length === 0) return [];

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
}

export const scriptAdaptationService = new ScriptAdaptationService();
