import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateSceneImageJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/falImage.service";

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
      console.log(`[SCENE_IMAGE] Got presigned URL for reference: ${key}`);
    } catch (error) {
      console.error(`[SCENE_IMAGE] Failed to get URL for ${key}:`, error);
    }
  }

  return urls;
}

const UGC_IPHONE_STYLE = `A vertical 9:16 UGC-style video frame captured on an iPhone. The composition is a medium-wide portrait, framed at true eye-level with a slightly forward-leaning posture for conversational authority.

Camera behavior uses the native iPhone lens (26mm equivalent): slightly wide, honest perspective, mild barrel softness at edges, minimal compression. Only tiny pockets of neural blur appear around hair edges—true iPhone depth-map artifacts.

Lighting is "Available Light": a mix of cool overcast daylight filtering through a window and warm tungsten from interior lights, creating imperfect balance and natural falloff. Shadows are soft but asymmetric. ISO noise from 500–900 sits naturally in midtones, producing sensor grain and mild vignetting (12% falloff).

Skin is rendered with natural texture: visible micro pores across the nose and cheeks, faint peach fuzz catching sidelight along the jawline, subtle stubble shadow density variation if male, and soft lip line diffusion. Natural oils break through on the forehead and nose bridge; no foundation, no filter. Faint dark circles sit under the eyes—realistic, lived-in.

Reality details: gentle 35mm film grain, light fingerprint smudge on lens glass, tiny dust haze in the air, and minimal chromatic aberration around high-contrast edges. No cinematic bloom, no studio finish.

Styling: raw UGC realism, available indoor light, mixed color temperature, minimal depth blur, slight lens smudge, visible ISO noise, no cinematic polish, emphasis on authenticity and true iPhone capture.`;

function buildSceneImagePrompt(
  sceneData: GenerateSceneImageJob["sceneData"],
  hasReferenceImages: boolean,
  userRefinement?: string
): string {
  const parts: string[] = [];

  if (hasReferenceImages) {
    parts.push(
      "REFERENCE IMAGES PROVIDED: Use the character reference image to maintain consistent identity. This must be the EXACT SAME person shown in the reference - same face, same features, same person.",
      ""
    );
  }

  parts.push(
    "UGC IPHONE AUTHENTICITY STYLE:",
    UGC_IPHONE_STYLE,
    "",
    "SCENE VISUAL DIRECTION:",
    sceneData.cinematicPrompt,
    "",
    "SCENE CONTEXT:",
    `- Scene Type: ${sceneData.sceneType}`,
    `- Camera Angle: ${sceneData.cameraAngle}`,
    `- Emotion: ${sceneData.emotion}`,
    `- Action: ${sceneData.action}`
  );

  if (userRefinement) {
    parts.push("", `USER NOTES: ${userRefinement}`);
  }

  parts.push(
    "",
    "CRITICAL OUTPUT FORMAT:",
    "- Generate EXACTLY ONE single image, NOT a collage, grid, matrix, or multiple images combined",
    "- The output must be a single photograph-style image as if taken by an iPhone camera",
    "- Do NOT create side-by-side comparisons, before/after layouts, or any multi-panel arrangements",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Photorealistic quality, indistinguishable from a real iPhone photograph",
    "- UGC/social media authentic aesthetic - NOT professional studio lighting",
    "- Vertical 9:16 aspect ratio for social media",
    "- Natural available light with mixed color temperature (daylight + tungsten)",
    "- Visible skin texture: pores, natural oils, imperfections",
    "- Sensor noise and grain consistent with iPhone in indoor lighting",
    "- Mild lens artifacts: slight vignette, chromatic aberration at edges",
    `- Expression matches emotion: ${sceneData.emotion}`,
    "- Correct human anatomy with natural proportions",
    "- Exactly two arms, exactly two hands with five fingers each",
    "- Natural body positioning and limb placement",
    "",
    "NEGATIVE: extra limbs, extra arms, extra hands, extra fingers, missing limbs, deformed hands, fused fingers, too many fingers, mutated hands, malformed limbs, bad anatomy, distorted body parts, unnatural arm positions, floating limbs, disconnected limbs, cartoon style, illustration, watermarks, text overlays, deformed features, unnatural colors, oversaturated images, collages, grids, multiple images, split images, side-by-side images, matrix layouts, photo grids, studio lighting, professional photography, perfect skin, airbrushed, beauty filter, cinematic lighting, dramatic shadows"
  );

  return parts.join("\n");
}

/**
 * Generate scene image using FAL AI
 */
async function generateSingleImage(
  prompt: string,
  teamId: number,
  scriptId: string,
  sceneId: string,
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

    const s3Key = await s3Service.uploadSceneImage(
      buffer,
      teamId,
      scriptId,
      sceneId,
      index
    );

    return s3Key;
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
    `[SCENE_IMAGE] Starting FAL AI generation for job ${jobId} (scene ${sceneNumber})`
  );

  try {
    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "generating",
        started_at: new Date(),
        progress: 0,
        progress_message: "Starting image generation...",
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));

    // Collect all reference image S3 keys
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
      allReferenceKeys.push(...productImageKeys.slice(0, 2));
      console.log(
        `[SCENE_IMAGE] Added ${Math.min(productImageKeys.length, 2)} product images`
      );
    }

    // 3. Add supporting images from user
    if (supportingImageKeys && supportingImageKeys.length > 0) {
      allReferenceKeys.push(...supportingImageKeys.slice(0, 2));
      console.log(
        `[SCENE_IMAGE] Added ${Math.min(supportingImageKeys.length, 2)} supporting images`
      );
    }

    // Get presigned URLs for reference images (FAL needs public URLs)
    await updateJobProgress(jobId, 10, "Preparing reference images...");
    const referenceImageUrls = await getReferenceImageUrls(allReferenceKeys);
    console.log(
      `[SCENE_IMAGE] Got ${referenceImageUrls.length} reference image URLs`
    );

    // Build the prompt
    const prompt = buildSceneImagePrompt(
      sceneData,
      referenceImageUrls.length > 0,
      userRefinement
    );

    await updateJobProgress(jobId, 30, "Generating scene image with FAL AI...");

    // Generate image using FAL (with or without reference images)
    const imageKey = await generateSingleImage(
      prompt,
      teamId,
      scriptId,
      sceneId,
      0,
      referenceImageUrls.length > 0 ? referenceImageUrls : undefined
    );

    if (!imageKey) {
      throw new Error("Failed to generate scene image");
    }

    const successfulImages = [imageKey];
    console.log(`[SCENE_IMAGE] Generated image for job ${jobId}`);

    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: "Image generated",
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
  }
}
