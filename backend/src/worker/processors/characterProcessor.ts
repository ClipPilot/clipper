import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateCharacterJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { buildPromptFromConfig } from "../../services/characterGeneration.service";
import { ENV } from "../../config/env";
import { notifyCharacterGenerated } from "../notify";

let googleClient: any = null;

const getGoogleClient = async () => {
  if (!googleClient) {
    const genai = await import("@google/genai");
    googleClient = new genai.GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
  }
  return googleClient;
};

const buildCharacterPrompt = (
  config: GenerateCharacterJob["config"],
  variationIndex: number
): string => {
  const variationHints = [
    "slight smile, relaxed posture",
    "neutral expression, direct gaze",
    "confident expression, slight head tilt",
    "friendly expression, natural pose",
  ];

  const hint = variationHints[variationIndex % variationHints.length];

  const outfitText =
    config.style.outfit === "other" && config.style.outfitCustom
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

async function generateSingleImage(
  ai: any,
  prompt: string,
  teamId: number,
  jobId: string,
  index: number
): Promise<string | null> {
  try {
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
            jobId,
            index
          );
          return s3Key;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to generate image variant ${index}:`, error);
    return null;
  }
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  message: string
): Promise<void> {
  await db
    .update(schema.characterGenerationJobs)
    .set({
      progress,
      progress_message: message,
    })
    .where(eq(schema.characterGenerationJobs.id, jobId));
}

export async function processCharacterJob(
  job: GenerateCharacterJob
): Promise<void> {
  const { jobId, teamId, userId, config, parentCharacterId } = job;

  console.log(`[CHARACTER] Starting generation for job ${jobId}`);

  try {
    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "generating",
        started_at: new Date(),
        progress: 0,
        progress_message: "Starting image generation...",
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));

    const ai = await getGoogleClient();
    const prompts = [0, 1, 2, 3].map((i) => buildCharacterPrompt(config, i));
    const basePrompt = prompts[0];

    await updateJobProgress(jobId, 10, "Generating 4 character variants...");

    const generationPromises = prompts.map((prompt, i) =>
      generateSingleImage(ai, prompt, teamId, jobId, i)
    );

    const results = await Promise.all(generationPromises);
    const successfulImages = results.filter((key): key is string => key !== null);

    if (successfulImages.length === 0) {
      throw new Error("Failed to generate any images");
    }

    console.log(
      `[CHARACTER] Generated ${successfulImages.length}/4 images for job ${jobId}`
    );

    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: `Generated ${successfulImages.length} images`,
        generated_images: successfulImages,
        generation_prompt: basePrompt,
        completed_at: new Date(),
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));

    await notifyCharacterGenerated(teamId, jobId);

    console.log(`[CHARACTER] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[CHARACTER] Job ${jobId} failed:`, error);

    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date(),
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));

    throw error;
  }
}
