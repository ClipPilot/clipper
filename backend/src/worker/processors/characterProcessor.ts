import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateCharacterJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/falImage.service";
import { notifyCharacterGenerated } from "../notify";

/**
 * Get presigned URLs for reference images (FAL needs public URLs)
 */
async function getReferenceImageUrls(imageKeys: string[]): Promise<string[]> {
  const MAX_REFERENCE_IMAGES = 5;
  const keysToFetch = imageKeys.slice(0, MAX_REFERENCE_IMAGES);
  const urls: string[] = [];

  for (const key of keysToFetch) {
    try {
      const url = await s3Service.getPresignedUrl(key, 3600); // 1 hour expiry
      urls.push(url);
      console.log(`[CHARACTER] Got presigned URL for reference: ${key}`);
    } catch (error) {
      console.error(`[CHARACTER] Failed to get URL for ${key}:`, error);
    }
  }

  return urls;
}

const buildCharacterPrompt = (
  config: GenerateCharacterJob["config"],
  variationIndex: number,
  isVariation: boolean = false
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

  const userChanges = config.style.anythingElse || "";

  if (isVariation && userChanges) {
    return `Create a photorealistic portrait photograph of the EXACT SAME person with:

PRESERVE EXACTLY (DO NOT CHANGE):
- Face: Same facial features, bone structure, and identity
- Hair: ${config.appearance.hairColor} color, ${config.appearance.hairStyle} style - keep identical
- Facial hair: If the original has beard, mustache, or stubble, keep it exactly the same. If clean-shaven, stay clean-shaven.
- Skin: ${config.appearance.skinTone} complexion - keep identical
- Eyes: ${config.appearance.eyeColor} colored eyes - keep identical
- Body type: ${config.appearance.bodyType} build - keep identical
- Age: ${config.ageRange} - keep identical
- Gender: ${config.gender} - keep identical
- Accessories: If the original has glasses, piercings, or accessories, keep them. If not, do not add any.

CHANGES REQUESTED BY USER:
${userChanges}

VARIATION STYLE:
${hint}

TECHNICAL REQUIREMENTS:
- The person must look like the EXACT SAME individual, just in a different situation
- Photorealistic quality, indistinguishable from a real photograph
- Natural skin texture with visible pores and subtle imperfections
- UGC/social media authentic aesthetic similar to iPhone photos
- Sharp focus on the face
- Vertical 3:4 aspect ratio composition
- Natural lighting

CRITICAL: This is the same person photographed in a different context. Maintain their identity, face shape, hair, facial hair, glasses, accessories, and body exactly. Only change what the user requested above.

NEGATIVE: Do not change the person's face, do not change hair color or style, do not add facial hair if originally clean-shaven, do not add glasses or accessories that were not in the original, extra limbs, extra arms, extra hands, extra fingers, missing limbs, deformed hands, fused fingers, too many fingers, mutated hands, malformed limbs, bad anatomy, distorted body parts, cartoon style, illustration, overly airbrushed skin, plastic-looking skin, deformed features, watermarks, text overlays, unnatural colors, oversaturated images.`;
  }

  const anythingElseText = userChanges
    ? `\n\nADDITIONAL DETAILS:\n${userChanges}`
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

NEGATIVE: Do not include extra limbs, extra arms, extra hands, extra fingers, missing limbs, deformed hands, fused fingers, too many fingers, mutated hands, malformed limbs, bad anatomy, distorted body parts, cartoon style, illustration, overly airbrushed skin, plastic-looking skin, deformed features, watermarks, text overlays, unnatural colors, oversaturated images.`;
};

async function generateSingleImage(
  prompt: string,
  teamId: number,
  jobId: string,
  index: number,
  referenceImageUrls?: string[]
): Promise<string | null> {
  try {
    const result = await falImageService.generateImageWithRetry({
      prompt,
      aspectRatio: "3:4",
      imageUrls: referenceImageUrls,
    });

    // Download image from FAL URL and upload to S3
    const response = await fetch(result.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image from FAL: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const s3Key = await s3Service.uploadCharacterImage(
      buffer,
      teamId,
      jobId,
      index
    );

    return s3Key;
  } catch (error) {
    console.error(`Failed to generate character image variant ${index}:`, error);
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

  console.log(`[CHARACTER] Starting FAL AI generation for job ${jobId}`);

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

    // Get presigned URLs for reference images (FAL needs public URLs)
    let referenceImageUrls: string[] = [];
    if (config.referenceImages && config.referenceImages.length > 0) {
      await updateJobProgress(jobId, 5, "Preparing reference images...");
      console.log(`[CHARACTER] Getting presigned URLs for ${config.referenceImages.length} reference images`);
      referenceImageUrls = await getReferenceImageUrls(config.referenceImages);
      console.log(`[CHARACTER] Got ${referenceImageUrls.length} reference image URLs`);
    }

    const hasReferenceImages = referenceImageUrls.length > 0;
    const prompts = [0, 1, 2, 3].map((i) => {
      let prompt = buildCharacterPrompt(config, i, isVariation);

      // Add reference image instructions if we have them
      if (hasReferenceImages) {
        prompt = `REFERENCE IMAGES PROVIDED: Use the provided reference images to maintain consistent character identity. The generated image must depict the EXACT SAME person shown in the reference images.

${prompt}

CRITICAL: Match the person's facial features, bone structure, and overall appearance from the reference images exactly. This is the same individual - maintain their unique identity.`;
      }

      return prompt;
    });
    const basePrompt = prompts[0];

    const progressMsg = hasReferenceImages
      ? `Generating 4 variants with ${referenceImageUrls.length} reference images...`
      : "Generating 4 character variants...";
    await updateJobProgress(jobId, 10, progressMsg);

    const generationPromises = prompts.map((prompt, i) =>
      generateSingleImage(prompt, teamId, jobId, i, hasReferenceImages ? referenceImageUrls : undefined)
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
  }
}
