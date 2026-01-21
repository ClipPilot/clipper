import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateSceneImageJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/falImage.service";

async function getReferenceImageUrls(imageKeys: string[]): Promise<string[]> {
  const MAX_REFERENCE_IMAGES = 5;
  const keysToFetch = imageKeys.slice(0, MAX_REFERENCE_IMAGES);
  const urls: string[] = [];

  for (const key of keysToFetch) {
    try {
      const url = await s3Service.getPresignedUrl(key, 3600);
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

type FrameType = "start" | "end";

// Scene types that should show the product prominently
const PRODUCT_VISIBLE_SCENE_TYPES = ["solution", "demo", "cta", "testimonial"];

// Helper to check if a scene type should include product reference images
function shouldIncludeProductImages(sceneType: string): boolean {
  return PRODUCT_VISIBLE_SCENE_TYPES.includes(sceneType.toLowerCase());
}


interface BRollShotData {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
}

function buildBRollShotPrompt(
  shot: BRollShotData,
  shotIndex: number,
  totalShots: number,
  sceneData: GenerateSceneImageJob["sceneData"],
  hasReferenceImages: boolean,
  productName?: string,
  userRefinement?: string
): string {
  const parts: string[] = [];

  if (hasReferenceImages) {
    const productDesc = productName ? `"${productName}"` : "the product";
    parts.push(
      `REFERENCE IMAGES PROVIDED: Use the product reference images to maintain consistent visual identity. Feature ${productDesc} prominently as shown in references. The product must look EXACTLY like the reference images.`,
      ""
    );
  }

  if (productName) {
    parts.push(
      `PRODUCT: ${productName}`,
      `Generate a B-roll shot featuring "${productName}" - ensure the product is clearly identifiable and matches the reference images.`,
      ""
    );
  }

  parts.push(
    "B-ROLL PRODUCT SHOT:",
    `Shot ${shotIndex + 1} of ${totalShots} in montage sequence`,
    "",
    "SHOT VISUAL DIRECTION:",
    shot.cinematicPrompt,
    "",
    "SHOT CONTEXT:",
    `- Shot Type: B-Roll Product Shot`,
    `- Action: ${shot.action}`,
    `- Duration: ${shot.durationSeconds} seconds`,
    `- Scene Type: ${sceneData.sceneType}`,
    `- Camera Angle: ${sceneData.cameraAngle}`
  );

  if (userRefinement) {
    parts.push("", `USER NOTES: ${userRefinement}`);
  }

  parts.push(
    "",
    "CRITICAL OUTPUT FORMAT:",
    "- Generate EXACTLY ONE single image, NOT a collage, grid, matrix, or multiple images combined",
    "- The output must be a single photograph-style image",
    "- Do NOT create side-by-side comparisons, before/after layouts, or any multi-panel arrangements",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Photorealistic quality, clean product photography",
    "- Vertical 9:16 aspect ratio for social media",
    "- Professional but authentic aesthetic - NOT overly polished stock imagery",
    "- Product should be clearly visible and the focal point",
    "- Natural or softbox lighting with proper shadows",
    "- Clean, uncluttered composition",
    "",
    "NEGATIVE: blurry, out of focus, watermarks, text overlays, deformed products, unrealistic colors, oversaturated images, collages, grids, multiple images, split images, hands holding product unless specified, human faces unless specified"
  );

  return parts.join("\n");
}

function buildSceneImagePrompt(
  sceneData: GenerateSceneImageJob["sceneData"],
  hasReferenceImages: boolean,
  hasProductImages: boolean,
  productName?: string,
  userRefinement?: string,
  frameType: FrameType = "start"
): string {
  const parts: string[] = [];

  if (hasReferenceImages) {
    const refDescription = hasProductImages && productName
      ? `Use the character reference image to maintain consistent identity. This must be the EXACT SAME person shown in the reference - same face, same features, same person. Also use the product reference images to accurately depict "${productName}".`
      : "Use the character reference image to maintain consistent identity. This must be the EXACT SAME person shown in the reference - same face, same features, same person.";
    parts.push(
      `REFERENCE IMAGES PROVIDED: ${refDescription}`,
      ""
    );
  }

  // Add explicit product context for product-focused scenes
  if (hasProductImages && productName) {
    parts.push(
      `PRODUCT FEATURED: "${productName}"`,
      `This scene should prominently feature the product "${productName}" as shown in the reference images. The product must be clearly visible and accurately depicted.`,
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

  // Add frame-specific instructions for start vs end frame
  if (frameType === "start") {
    parts.push(
      "",
      "FRAME TIMING: START FRAME",
      "- This is the BEGINNING moment of the scene",
      "- Character is about to begin the action, initial anticipation",
      "- Product/device in starting position",
      "- Expression shows initial emotion before transformation"
    );
  } else {
    parts.push(
      "",
      "FRAME TIMING: END FRAME",
      "- This is the FINAL moment of the scene",
      "- Action has been completed, result is visible",
      "- Product/device in final position after interaction",
      "- Expression shows satisfied/transformed emotion after the action",
      "- Keep the SAME camera angle, framing, and setting as start frame"
    );
  }

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
    productName,
    userRefinement,
    supportingImageKeys,
    generateEndFrame,
    customStartImageKey,
    customEndImageKey,
    bRollShots,
    singleBRollShotIndex,
    existingBRollImages,
  } = job;

  // Determine if this scene type should include product reference images
  const includeProductImages = shouldIncludeProductImages(sceneData.sceneType);

  console.log(
    `[SCENE_IMAGE] Starting FAL AI generation for job ${jobId} (scene ${sceneNumber})`
  );
  console.log(
    `[SCENE_IMAGE] Options: generateEndFrame=${generateEndFrame}, customStart=${!!customStartImageKey}, customEnd=${!!customEndImageKey}, bRollShots=${bRollShots?.length || 0}, singleShotIdx=${singleBRollShotIndex ?? "all"}`
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

    if (bRollShots && bRollShots.length > 0) {
      const isSingleShotRegen = singleBRollShotIndex !== undefined && singleBRollShotIndex >= 0;

      if (isSingleShotRegen) {
        console.log(
          `[SCENE_IMAGE] Regenerating single B-roll shot ${singleBRollShotIndex + 1} of ${bRollShots.length} for job ${jobId}`
        );
      } else {
        console.log(
          `[SCENE_IMAGE] Generating ${bRollShots.length} B-roll montage images for job ${jobId}`
        );
      }

      const generatedImages: string[] = isSingleShotRegen && existingBRollImages
        ? [...existingBRollImages]
        : [];

      let characterReferenceUrl: string | null = null;
      if (characterId) {
        const [character] = await db
          .select()
          .from(schema.characters)
          .where(eq(schema.characters.id, characterId));

        if (character) {
          const characterImages = character.character_images as string[];
          const primaryIndex = character.primary_image_index || 0;
          if (characterImages && characterImages[primaryIndex]) {
            const urls = await getReferenceImageUrls([characterImages[primaryIndex]]);
            if (urls.length > 0) {
              characterReferenceUrl = urls[0];
              console.log(`[SCENE_IMAGE] B-roll: Character reference loaded: ${characterImages[primaryIndex]}`);
            } else {
              console.warn(`[SCENE_IMAGE] B-roll: Failed to get URL for character image`);
            }
          } else {
            console.warn(`[SCENE_IMAGE] B-roll: Character has no images at index ${primaryIndex}`);
          }
        } else {
          console.warn(`[SCENE_IMAGE] B-roll: Character ${characterId} not found`);
        }
      } else {
        console.warn(`[SCENE_IMAGE] B-roll: No characterId provided`);
      }

      const productReferenceUrls = productImageKeys && productImageKeys.length > 0
        ? await getReferenceImageUrls(productImageKeys.slice(0, 3))
        : [];
      const supportingReferenceUrls = supportingImageKeys && supportingImageKeys.length > 0
        ? await getReferenceImageUrls(supportingImageKeys.slice(0, 2))
        : [];

      for (let i = 0; i < bRollShots.length; i++) {
        if (isSingleShotRegen && i !== singleBRollShotIndex) {
          continue;
        }

        const shot = bRollShots[i];
        const progressPercent = isSingleShotRegen
          ? 50
          : Math.round(((i + 1) / bRollShots.length) * 80);

        await updateJobProgress(
          jobId,
          progressPercent,
          isSingleShotRegen
            ? `Regenerating shot ${i + 1}...`
            : `Generating B-roll shot ${i + 1} of ${bRollShots.length}...`
        );

        const shotNeedsProduct = shot.productImageNeeded ?? true;
        const shotReferenceUrls: string[] = [];

        if (characterReferenceUrl) {
          shotReferenceUrls.push(characterReferenceUrl);
        }

        if (shotNeedsProduct && productReferenceUrls.length > 0) {
          shotReferenceUrls.push(...productReferenceUrls);
          console.log(
            `[SCENE_IMAGE] Shot ${i + 1}: Including character + product images`
          );
        } else {
          console.log(
            `[SCENE_IMAGE] Shot ${i + 1}: Including character only (productImageNeeded=false)`
          );
        }

        if (supportingReferenceUrls.length > 0) {
          shotReferenceUrls.push(...supportingReferenceUrls);
        }

        const hasReferences = shotReferenceUrls.length > 0;
        const refs = hasReferences ? shotReferenceUrls : undefined;

        const shotPrompt = buildBRollShotPrompt(
          shot,
          i,
          bRollShots.length,
          sceneData,
          hasReferences && shotNeedsProduct,
          shotNeedsProduct ? productName : undefined,
          userRefinement
        );

        console.log(
          `[SCENE_IMAGE] Generating B-roll shot ${i + 1}: "${shot.action.substring(0, 50)}..."`
        );

        const result = await falImageService.generateImageWithRetry({
          prompt: shotPrompt,
          aspectRatio: "3:4",
          imageUrls: refs,
        });

        const response = await fetch(result.imageUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to download B-roll shot ${i + 1} from FAL: ${response.status}`
          );
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const imageKey = await s3Service.uploadSceneImage(
          buffer,
          teamId,
          scriptId,
          sceneId,
          i
        );

        console.log(
          `[SCENE_IMAGE] Generated B-roll shot ${i + 1} for job ${jobId}: ${imageKey}`
        );

        if (isSingleShotRegen) {
          generatedImages[i] = imageKey;
        } else {
          generatedImages.push(imageKey);
        }
      }

      await db
        .update(schema.sceneImageGenerationJobs)
        .set({
          status: "completed",
          progress: 100,
          progress_message: isSingleShotRegen
            ? `Shot ${singleBRollShotIndex! + 1} regenerated`
            : `${bRollShots.length} B-roll montage shots generated`,
          generated_images: generatedImages,
          completed_at: new Date(),
        })
        .where(eq(schema.sceneImageGenerationJobs.id, jobId));

      console.log(
        `[SCENE_IMAGE] Job ${jobId} completed${isSingleShotRegen ? ` (single shot ${singleBRollShotIndex! + 1})` : ""} with ${generatedImages.length} B-roll shot image(s)`
      );
      return;
    }

    const generatedImages: string[] = [];

    // If user uploaded a custom start image, use that instead of generating
    if (customStartImageKey) {
      console.log(`[SCENE_IMAGE] Using custom start image: ${customStartImageKey}`);
      generatedImages.push(customStartImageKey);
      await updateJobProgress(jobId, 40, "Using custom start image...");
    } else {
      // Generate start image
      const allReferenceKeys: string[] = [];

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

      // Only include product images for scene types where product should be visible
      const hasProductInScene = includeProductImages && productImageKeys && productImageKeys.length > 0;
      if (hasProductInScene) {
        allReferenceKeys.push(...productImageKeys.slice(0, 2));
        console.log(
          `[SCENE_IMAGE] Added ${Math.min(productImageKeys.length, 2)} product images for ${sceneData.sceneType} scene`
        );
      } else if (productImageKeys && productImageKeys.length > 0) {
        console.log(
          `[SCENE_IMAGE] Skipping product images for ${sceneData.sceneType} scene (product not visible in this scene type)`
        );
      }

      if (supportingImageKeys && supportingImageKeys.length > 0) {
        allReferenceKeys.push(...supportingImageKeys.slice(0, 2));
        console.log(
          `[SCENE_IMAGE] Added ${Math.min(supportingImageKeys.length, 2)} supporting images`
        );
      }

      await updateJobProgress(jobId, 10, "Preparing reference images...");
      const referenceImageUrls = await getReferenceImageUrls(allReferenceKeys);
      console.log(
        `[SCENE_IMAGE] Got ${referenceImageUrls.length} reference image URLs`
      );

      const hasReferences = referenceImageUrls.length > 0;
      const refs = hasReferences ? referenceImageUrls : undefined;

      await updateJobProgress(jobId, 30, "Generating start frame...");
      const startPrompt = buildSceneImagePrompt(sceneData, hasReferences, hasProductInScene, productName, userRefinement, "start");

      const startResult = await falImageService.generateImageWithRetry({
        prompt: startPrompt,
        aspectRatio: "3:4",
        imageUrls: refs,
      });

      const startResponse = await fetch(startResult.imageUrl);
      if (!startResponse.ok) {
        throw new Error(`Failed to download start image from FAL: ${startResponse.status}`);
      }

      const startBuffer = Buffer.from(await startResponse.arrayBuffer());
      const startImageKey = await s3Service.uploadSceneImage(
        startBuffer,
        teamId,
        scriptId,
        sceneId,
        0 // variant 0 = start frame
      );

      console.log(`[SCENE_IMAGE] Generated start frame for job ${jobId}: ${startImageKey}`);
      generatedImages.push(startImageKey);
    }

    // Handle end frame if requested
    if (generateEndFrame || customEndImageKey) {
      if (customEndImageKey) {
        console.log(`[SCENE_IMAGE] Using custom end image: ${customEndImageKey}`);
        generatedImages.push(customEndImageKey);
        await updateJobProgress(jobId, 80, "Using custom end image...");
      } else {
        await updateJobProgress(jobId, 60, "Generating end frame...");

        const endReferenceKeys: string[] = [];

        // Add start frame as primary reference for consistency
        const startFrameKey = generatedImages[0];
        if (startFrameKey) {
          endReferenceKeys.push(startFrameKey);
          console.log(`[SCENE_IMAGE] Using start frame as reference for end frame: ${startFrameKey}`);
        }

        if (characterId) {
          const [character] = await db
            .select()
            .from(schema.characters)
            .where(eq(schema.characters.id, characterId));

          if (character) {
            const characterImages = character.character_images as string[];
            const primaryIndex = character.primary_image_index || 0;
            if (characterImages[primaryIndex]) {
              endReferenceKeys.push(characterImages[primaryIndex]);
            }
          }
        }

        // Only include product images for scene types where product should be visible
        const hasProductInEndFrame = includeProductImages && productImageKeys && productImageKeys.length > 0;
        if (hasProductInEndFrame) {
          endReferenceKeys.push(...productImageKeys.slice(0, 2));
        }

        if (supportingImageKeys && supportingImageKeys.length > 0) {
          endReferenceKeys.push(...supportingImageKeys.slice(0, 2));
        }

        const endReferenceUrls = await getReferenceImageUrls(endReferenceKeys);
        const endPrompt = buildSceneImagePrompt(sceneData, true, hasProductInEndFrame, productName, userRefinement, "end");

        const endResult = await falImageService.generateImageWithRetry({
          prompt: endPrompt,
          aspectRatio: "3:4",
          imageUrls: endReferenceUrls,
        });

        const endResponse = await fetch(endResult.imageUrl);
        if (!endResponse.ok) {
          throw new Error(`Failed to download end image from FAL: ${endResponse.status}`);
        }

        const endBuffer = Buffer.from(await endResponse.arrayBuffer());
        const endImageKey = await s3Service.uploadSceneImage(
          endBuffer,
          teamId,
          scriptId,
          sceneId,
          1
        );

        console.log(`[SCENE_IMAGE] Generated end frame for job ${jobId}: ${endImageKey}`);
        generatedImages.push(endImageKey);
      }
    }

    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: generateEndFrame || customEndImageKey
          ? "Start and end frames generated"
          : "Scene image generated",
        generated_images: generatedImages,
        completed_at: new Date(),
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));

    console.log(`[SCENE_IMAGE] Job ${jobId} completed with ${generatedImages.length} image(s)`);
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
