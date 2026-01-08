import { ENV } from "../config/env";
import { s3Service } from "./s3.service";

export interface AppearanceConfig {
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  eyeColor: string;
  bodyType: string;
}

export interface StyleConfig {
  outfit: string;
  outfitCustom?: string;
  setting: string;
  cameraStyle: string;
  anythingElse?: string;
}

export interface CharacterConfig {
  gender: string;
  ageRange: string;
  appearance: AppearanceConfig;
  style: StyleConfig;
  referenceImages?: string[];
}

interface GeneratedImage {
  buffer: Buffer;
  index: number;
}

let googleClient: any = null;

const getGoogleClient = async () => {
  if (!googleClient) {
    const genai = await import("@google/genai");
    googleClient = new genai.GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
  }
  return googleClient;
};

const buildCharacterPrompt = (config: CharacterConfig, variationIndex: number): string => {
  const variationHints = [
    "slight smile, relaxed posture",
    "neutral expression, direct gaze",
    "confident expression, slight head tilt",
    "friendly expression, natural pose",
  ];

  const hint = variationHints[variationIndex % variationHints.length];

  const outfitText = config.style.outfit === "other" && config.style.outfitCustom
    ? config.style.outfitCustom
    : config.style.outfit;

  const anythingElseText = config.style.anythingElse
    ? `\n\nADDITIONAL DETAILS:\n${config.style.anythingElse}`
    : "";

  return `Create a photorealistic portrait photograph of a ${config.gender} person in their ${config.ageRange} age range.

APPEARANCE:
Hair: ${config.appearance.hairColor} color, ${config.appearance.hairStyle} style.
Skin: ${config.appearance.skinTone} complexion with natural texture and visible pores.
Eyes: ${config.appearance.eyeColor} colored eyes.
Body type: ${config.appearance.bodyType} build.

STYLE AND SETTING:
Wearing ${outfitText} attire that looks natural and authentic.
Setting: ${config.style.setting || "cozy indoor"} environment.
Camera perspective: ${config.style.cameraStyle} style shot.

EXPRESSION AND POSE:
${hint}
${anythingElseText}

TECHNICAL REQUIREMENTS:
- Photorealistic quality, indistinguishable from a real photograph
- Natural skin texture with visible pores and subtle imperfections
- Direct eye contact with the camera
- UGC/social media authentic aesthetic similar to iPhone photos
- Sharp focus on the face
- Vertical 3:4 aspect ratio composition
- Natural lighting

NEGATIVE: Do not include cartoon style, illustration, overly airbrushed skin, plastic-looking skin, extra limbs, deformed features, watermarks, text overlays, unnatural colors, oversaturated images.`;
};

export const generateCharacterImages = async (
  config: CharacterConfig,
  teamId: number,
  characterId: string
): Promise<string[]> => {
  const ai = await getGoogleClient();
  const generatedImages: string[] = [];

  for (let i = 0; i < 4; i++) {
    try {
      const prompt = buildCharacterPrompt(config, i);

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: prompt,
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "3:4",
            imageSize: "2K",
          },
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const buffer = Buffer.from(part.inlineData.data, "base64");
            const s3Key = await s3Service.uploadCharacterImage(
              buffer,
              teamId,
              characterId,
              i
            );
            generatedImages.push(s3Key);
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to generate character image variant ${i}:`, error);
    }
  }

  return generatedImages;
};

export const generateVariationImages = async (
  baseAppearance: AppearanceConfig,
  gender: string,
  ageRange: string,
  newStyle: StyleConfig,
  teamId: number,
  characterId: string
): Promise<string[]> => {
  const config: CharacterConfig = {
    gender,
    ageRange,
    appearance: baseAppearance,
    style: newStyle,
  };

  return generateCharacterImages(config, teamId, characterId);
};

export const buildPromptFromConfig = (config: CharacterConfig): string => {
  return buildCharacterPrompt(config, 0);
};
