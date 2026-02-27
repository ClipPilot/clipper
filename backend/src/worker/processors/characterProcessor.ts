import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateCharacterJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/ai-ugc/falImage.service";
import { notifyCharacterGenerated } from "../notify";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";
import {
  generateCharacterPromptSchema,
  schemaToPrompt,
  schemaToVariationPrompt,
} from "./characterPromptSchema";

async function getReferenceImageUrls(imageKeys: string[]): Promise<string[]> {
  const keysToFetch = imageKeys.slice(0, 5);
  const urls: string[] = [];

  for (const key of keysToFetch) {
    try {
      const url = await s3Service.getPresignedUrl(key, 3600);
      urls.push(url);
    } catch (error) {
      console.error(`[CHARACTER] Failed to get URL for ${key}:`, error);
    }
  }

  return urls;
}

async function generateSingleImage(
  prompt: string,
  teamId: number,
  jobId: string,
  index: number,
  referenceImageUrls?: string[]
): Promise<string | null> {
  try {
    console.log(`[CHARACTER] Generating variant ${index + 1} with prompt (${prompt.length} chars)`);

    const result = await falImageService.generateImageWithRetry({
      prompt,
      aspectRatio: "9:16",
      imageUrls: referenceImageUrls,
    });

    const response = await fetch(result.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await s3Service.uploadCharacterImage(buffer, teamId, jobId, index);
  } catch (error) {
    console.error(`[CHARACTER] Failed to generate variant ${index + 1}:`, error);
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
    .set({ progress, progress_message: message })
    .where(eq(schema.characterGenerationJobs.id, jobId));
}

export async function processCharacterJob(job: GenerateCharacterJob): Promise<void> {
  const { jobId, teamId, config, parentCharacterId } = job;

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

    const isVariation = !!parentCharacterId;
    const userChanges = config.style.anythingElse || "";

    let referenceImageUrls: string[] = [];
    if (config.referenceImages && config.referenceImages.length > 0) {
      await updateJobProgress(jobId, 5, "Preparing reference images...");
      referenceImageUrls = await getReferenceImageUrls(config.referenceImages);
      console.log(`[CHARACTER] Got ${referenceImageUrls.length} reference images`);
    }

    const hasReferenceImages = referenceImageUrls.length > 0;

    await updateJobProgress(jobId, 10, "Generating detailed prompt schemas...");

    console.log(`[CHARACTER] Building 4 schemas in parallel...`);

    const schemaPromises = [0, 1, 2, 3].map((i) => generateCharacterPromptSchema(config, i));
    const schemas = await Promise.all(schemaPromises);

    const userNotes = config.style.anythingElse || "";

    const prompts = schemas.map((promptSchema, i) => {
      let prompt: string;

      if (isVariation && userChanges) {
        prompt = schemaToVariationPrompt(promptSchema, userChanges);
      } else {
        prompt = schemaToPrompt(promptSchema, userNotes);
      }

      if (hasReferenceImages) {
        prompt = `REFERENCE IMAGES: Match the exact person shown. Same facial features, bone structure, skin tone, and identity.

${prompt}

CRITICAL: Generate the SAME person as the reference. Identical face, identical features.`;
      }

      console.log(`[CHARACTER] Variant ${i + 1} prompt ready (${prompt.length} chars)`);
      return prompt;
    });

    await updateJobProgress(
      jobId,
      20,
      hasReferenceImages
        ? `Generating 4 variants with ${referenceImageUrls.length} references...`
        : "Generating 4 character variants..."
    );

    const results = await Promise.all(
      prompts.map((prompt, i) =>
        generateSingleImage(
          prompt,
          teamId,
          jobId,
          i,
          hasReferenceImages ? referenceImageUrls : undefined
        )
      )
    );

    const successfulImages = results.filter((key): key is string => key !== null);

    if (successfulImages.length === 0) {
      throw new Error("Failed to generate any images");
    }

    console.log(`[CHARACTER] Generated ${successfulImages.length}/4 images for job ${jobId}`);

    await db
      .update(schema.characterGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: `Generated ${successfulImages.length} images`,
        generated_images: successfulImages,
        generation_prompt: prompts[0],
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
        error_message: sanitizeErrorForFrontend(error, "Character generation failed. Please try again."),
        completed_at: new Date(),
      })
      .where(eq(schema.characterGenerationJobs.id, jobId));
  }
}
