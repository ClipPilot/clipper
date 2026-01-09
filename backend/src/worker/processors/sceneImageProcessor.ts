import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateSceneImageJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { ENV } from "../../config/env";

let googleClient: any = null;

const getGoogleClient = async () => {
  if (!googleClient) {
    const genai = await import("@google/genai");
    googleClient = new genai.GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
  }
  return googleClient;
};

interface ReferenceImageData {
  mimeType: string;
  base64: string;
}

const getMimeType = (key: string): string => {
  const ext = key.toLowerCase().split(".").pop();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
};

async function fetchReferenceImages(
  imageKeys: string[]
): Promise<ReferenceImageData[]> {
  const MAX_REFERENCE_IMAGES = 5;
  const keysToFetch = imageKeys.slice(0, MAX_REFERENCE_IMAGES);

  const results: ReferenceImageData[] = [];

  for (const key of keysToFetch) {
    try {
      const buffer = await s3Service.getImageAsBuffer(key);
      results.push({
        mimeType: getMimeType(key),
        base64: buffer.toString("base64"),
      });
      console.log(`[SCENE_IMAGE] Fetched reference image: ${key}`);
    } catch (error) {
      console.error(
        `[SCENE_IMAGE] Failed to fetch reference image ${key}:`,
        error
      );
    }
  }

  return results;
}

/**
 * Build the scene image generation prompt
 */
function buildSceneImagePrompt(
  sceneData: GenerateSceneImageJob["sceneData"],
  userRefinement?: string
): string {
  const parts: string[] = [
    "REFERENCE IMAGES PROVIDED: Use the character reference image to maintain consistent identity. This must be the EXACT SAME person shown in the reference.",
    "",
    "SCENE VISUAL DIRECTION:",
    sceneData.cinematicPrompt,
    "",
    "ADDITIONAL CONTEXT:",
    `- Scene Type: ${sceneData.sceneType}`,
    `- Camera Angle: ${sceneData.cameraAngle}`,
    `- Emotion: ${sceneData.emotion}`,
    `- Action: ${sceneData.action}`,
  ];

  if (userRefinement) {
    parts.push("", `USER NOTES: ${userRefinement}`);
  }

  parts.push(
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Photorealistic quality, indistinguishable from a real photograph",
    "- UGC/social media authentic aesthetic similar to iPhone photos",
    "- Vertical 3:4 aspect ratio",
    "- Natural lighting appropriate for the scene",
    `- Expression matches emotion: ${sceneData.emotion}`,
    "",
    "NEGATIVE: Do not include cartoon style, illustration, watermarks, text overlays, deformed features, unnatural colors, oversaturated images"
  );

  return parts.join("\n");
}

/**
 * Generate a single scene image variation
 */
async function generateSingleImage(
  ai: any,
  prompt: string,
  teamId: number,
  scriptId: string,
  sceneId: string,
  index: number,
  referenceImages?: ReferenceImageData[]
): Promise<string | null> {
  try {
    const contents: any[] = [];

    // Add reference images first (character + product + supporting)
    if (referenceImages && referenceImages.length > 0) {
      for (const refImage of referenceImages) {
        contents.push({
          inlineData: {
            mimeType: refImage.mimeType,
            data: refImage.base64,
          },
        });
      }
    }

    // Add the text prompt
    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: contents,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K", // Use 1K for cost savings (~$0.134 vs $0.24 for 4K)
        },
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const s3Key = await s3Service.uploadSceneImage(
            buffer,
            teamId,
            scriptId,
            sceneId,
            index
          );
          return s3Key;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to generate scene image variant ${index}:`, error);
    return null;
  }
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  message: string
): Promise<void> {
  await db
    .update(schema.sceneImageGenerationJobs)
    .set({
      progress,
      progress_message: message,
    })
    .where(eq(schema.sceneImageGenerationJobs.id, jobId));
}

/**
 * Main processor for scene image generation jobs
 */
export async function processSceneImageJob(
  job: GenerateSceneImageJob
): Promise<void> {
  const {
    jobId,
    teamId,
    scriptId,
    sceneId,
    sceneNumber,
    characterId,
    sceneData,
    productImageKeys,
    userRefinement,
    supportingImageKeys,
  } = job;

  console.log(
    `[SCENE_IMAGE] Starting generation for job ${jobId} (scene ${sceneNumber})`
  );

  try {
    // Update status to "generating"
    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "generating",
        started_at: new Date(),
        progress: 0,
        progress_message: "Starting image generation...",
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));

    const ai = await getGoogleClient();

    // Collect all reference images
    const allReferenceKeys: string[] = [];

    // 1. Fetch character's primary image for identity consistency
    if (characterId) {
      const [character] = await db
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.id, characterId));

      if (character) {
        const characterImages = character.character_images as string[];
        const primaryIndex = character.primary_image_index || 0;
        if (characterImages[primaryIndex]) {
          allReferenceKeys.push(characterImages[primaryIndex]);
          console.log(
            `[SCENE_IMAGE] Added character reference: ${characterImages[primaryIndex]}`
          );
        }
      }
    }

    // 2. Add product images for context
    if (productImageKeys && productImageKeys.length > 0) {
      allReferenceKeys.push(...productImageKeys.slice(0, 2)); // Max 2 product images
      console.log(
        `[SCENE_IMAGE] Added ${Math.min(productImageKeys.length, 2)} product images`
      );
    }

    // 3. Add supporting images from user
    if (supportingImageKeys && supportingImageKeys.length > 0) {
      allReferenceKeys.push(...supportingImageKeys.slice(0, 2)); // Max 2 supporting images
      console.log(
        `[SCENE_IMAGE] Added ${Math.min(supportingImageKeys.length, 2)} supporting images`
      );
    }

    // Fetch reference images
    await updateJobProgress(jobId, 10, "Loading reference images...");
    const referenceImageData = await fetchReferenceImages(allReferenceKeys);
    console.log(
      `[SCENE_IMAGE] Loaded ${referenceImageData.length} reference images`
    );

    // Build the prompt using cinematicPrompt from OpenAI
    const prompt = buildSceneImagePrompt(sceneData, userRefinement);

    await updateJobProgress(jobId, 20, "Generating 4 scene image variants...");

    // Generate 4 variations
    const generationPromises = [0, 1, 2, 3].map((i) =>
      generateSingleImage(
        ai,
        prompt,
        teamId,
        scriptId,
        sceneId,
        i,
        referenceImageData
      )
    );

    const results = await Promise.all(generationPromises);
    const successfulImages = results.filter(
      (key): key is string => key !== null
    );

    if (successfulImages.length === 0) {
      throw new Error("Failed to generate any scene images");
    }

    console.log(
      `[SCENE_IMAGE] Generated ${successfulImages.length}/4 images for job ${jobId}`
    );

    // Update job as completed
    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: `Generated ${successfulImages.length} images`,
        generated_images: successfulImages,
        completed_at: new Date(),
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));

    console.log(`[SCENE_IMAGE] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[SCENE_IMAGE] Job ${jobId} failed:`, error);

    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date(),
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));

    throw error;
  }
}
