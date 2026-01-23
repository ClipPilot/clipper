import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateSceneImageJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/ai-ugc/falImage.service";
import {
  CharacterAppearance,
  ImagePositions,
  buildBRollShotPrompt,
  buildSceneImagePrompt,
} from "./sceneImagePrompts";

const PRODUCT_VISIBLE_SCENE_TYPES = ["solution", "demo", "cta", "testimonial"];

function shouldIncludeProductImages(sceneType: string): boolean {
  return PRODUCT_VISIBLE_SCENE_TYPES.includes(sceneType.toLowerCase());
}

async function getReferenceImageUrls(imageKeys: string[]): Promise<string[]> {
  const MAX_REFERENCE_IMAGES = 5;
  const keysToFetch = imageKeys.slice(0, MAX_REFERENCE_IMAGES);
  const urls: string[] = [];

  for (const key of keysToFetch) {
    try {
      const url = await s3Service.getPresignedUrl(key, 3600);
      urls.push(url);
    } catch (error) {
      console.error(`[SCENE_IMAGE] Failed to get URL for ${key}:`, error);
    }
  }

  return urls;
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  message: string,
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
  job: GenerateSceneImageJob,
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
    previousArollImageKey,
  } = job;

  const includeProductImages = shouldIncludeProductImages(sceneData.sceneType);

  console.log(
    `[SCENE_IMAGE] Starting FAL AI generation for job ${jobId} (scene ${sceneNumber})`,
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
      const isSingleShotRegen =
        singleBRollShotIndex !== undefined && singleBRollShotIndex >= 0;

      const generatedImages: string[] =
        isSingleShotRegen && existingBRollImages
          ? [...existingBRollImages]
          : [];

      let characterReferenceUrl: string | null = null;
      let characterAppearance: CharacterAppearance | undefined;

      if (characterId) {
        const [character] = await db
          .select()
          .from(schema.characters)
          .where(eq(schema.characters.id, characterId));

        if (character) {
          const characterImages = character.character_images as string[];
          const primaryIndex = character.primary_image_index || 0;
          if (characterImages && characterImages[primaryIndex]) {
            const urls = await getReferenceImageUrls([
              characterImages[primaryIndex],
            ]);
            if (urls.length > 0) {
              characterReferenceUrl = urls[0];
            }
          }
          const appearanceConfig = character.appearance_config as Record<
            string,
            string
          > | null;
          if (appearanceConfig) {
            characterAppearance = {
              gender: character.gender,
              ageRange: character.age_range,
              skinTone: appearanceConfig.skinTone,
              hairColor: appearanceConfig.hairColor,
              hairStyle: appearanceConfig.hairStyle,
              eyeColor: appearanceConfig.eyeColor,
              bodyType: appearanceConfig.bodyType,
            };
          }
        }
      }

      const productReferenceUrls =
        productImageKeys && productImageKeys.length > 0
          ? await getReferenceImageUrls(productImageKeys.slice(0, 3))
          : [];

      const supportingReferenceUrls =
        supportingImageKeys && supportingImageKeys.length > 0
          ? await getReferenceImageUrls(supportingImageKeys.slice(0, 2))
          : [];

      const existingImageUrls: (string | null)[] = [];
      if (existingBRollImages && existingBRollImages.length > 0) {
        for (const key of existingBRollImages) {
          if (key) {
            try {
              const url = await s3Service.getPresignedUrl(key, 3600);
              existingImageUrls.push(url);
            } catch (e) {
              existingImageUrls.push(null);
            }
          } else {
            existingImageUrls.push(null);
          }
        }
      }

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
            : `Generating B-roll shot ${i + 1} of ${bRollShots.length}...`,
        );

        const shotNeedsProduct = shot.productImageNeeded ?? true;
        const shotReferenceUrls: string[] = [];

        if (supportingReferenceUrls.length > 0) {
          shotReferenceUrls.push(...supportingReferenceUrls);
        }

        const originalImageUrl = existingImageUrls[i];
        if (originalImageUrl) {
          shotReferenceUrls.push(originalImageUrl);
        }

        if (characterReferenceUrl) {
          shotReferenceUrls.push(characterReferenceUrl);
        }

        if (shotNeedsProduct && productReferenceUrls.length > 0) {
          shotReferenceUrls.push(...productReferenceUrls);
        }

        const hasReferences = shotReferenceUrls.length > 0;
        const refs = hasReferences ? shotReferenceUrls : undefined;

        const imagePositions: ImagePositions = {
          supportingCount: supportingReferenceUrls.length,
          hasOriginal: !!originalImageUrl,
          hasCharacter: !!characterReferenceUrl,
          productCount:
            shotNeedsProduct && productReferenceUrls.length > 0
              ? productReferenceUrls.length
              : 0,
        };

        const shotPrompt = buildBRollShotPrompt(
          shot,
          i,
          bRollShots.length,
          sceneData,
          hasReferences,
          shotNeedsProduct ? productName : undefined,
          userRefinement,
          characterAppearance,
          imagePositions,
        );

        const result = await falImageService.generateImageWithRetry({
          prompt: shotPrompt,
          aspectRatio: "3:4",
          imageUrls: refs,
          usePro: true,
        });

        const response = await fetch(result.imageUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to download B-roll shot ${i + 1} from FAL: ${response.status}`,
          );
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const imageKey = await s3Service.uploadSceneImage(
          buffer,
          teamId,
          scriptId,
          sceneId,
          i,
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

      return;
    }

    const generatedImages: string[] = [];
    let characterAppearance: CharacterAppearance | undefined;

    if (customStartImageKey) {
      generatedImages.push(customStartImageKey);
      await updateJobProgress(jobId, 40, "Using custom start image...");
    } else {
      const allReferenceKeys: string[] = [];

      if (previousArollImageKey) {
        allReferenceKeys.push(previousArollImageKey);
        console.log(`[SCENE_IMAGE] Using previous A-roll image for visual consistency`);
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
            allReferenceKeys.push(characterImages[primaryIndex]);
          }
          const appearanceConfig = character.appearance_config as Record<
            string,
            string
          > | null;
          if (appearanceConfig) {
            characterAppearance = {
              gender: character.gender,
              ageRange: character.age_range,
              skinTone: appearanceConfig.skinTone,
              hairColor: appearanceConfig.hairColor,
              hairStyle: appearanceConfig.hairStyle,
              eyeColor: appearanceConfig.eyeColor,
              bodyType: appearanceConfig.bodyType,
            };
          }
        }
      }

      const hasProductInScene =
        includeProductImages && productImageKeys && productImageKeys.length > 0;
      if (hasProductInScene) {
        allReferenceKeys.push(...productImageKeys.slice(0, 2));
      }

      const hasSupportingImages =
        supportingImageKeys && supportingImageKeys.length > 0;
      if (hasSupportingImages) {
        allReferenceKeys.push(...supportingImageKeys.slice(0, 2));
      }

      await updateJobProgress(jobId, 10, "Preparing reference images...");
      const referenceImageUrls = await getReferenceImageUrls(allReferenceKeys);

      const hasReferences = referenceImageUrls.length > 0;
      const refs = hasReferences ? referenceImageUrls : undefined;

      await updateJobProgress(jobId, 30, "Generating start frame...");
      const startPrompt = buildSceneImagePrompt(
        sceneData,
        hasReferences,
        hasProductInScene,
        productName,
        userRefinement,
        "start",
        characterAppearance,
        hasSupportingImages,
      );

      const startResult = await falImageService.generateImageWithRetry({
        prompt: startPrompt,
        aspectRatio: "3:4",
        imageUrls: refs,
        usePro: true,
      });

      const startResponse = await fetch(startResult.imageUrl);
      if (!startResponse.ok) {
        throw new Error(
          `Failed to download start image from FAL: ${startResponse.status}`,
        );
      }

      const startBuffer = Buffer.from(await startResponse.arrayBuffer());
      const startImageKey = await s3Service.uploadSceneImage(
        startBuffer,
        teamId,
        scriptId,
        sceneId,
        0,
      );

      generatedImages.push(startImageKey);
    }

    if (generateEndFrame || customEndImageKey) {
      if (customEndImageKey) {
        generatedImages.push(customEndImageKey);
        await updateJobProgress(jobId, 80, "Using custom end image...");
      } else {
        await updateJobProgress(jobId, 60, "Generating end frame...");

        const endReferenceKeys: string[] = [];

        const startFrameKey = generatedImages[0];
        if (startFrameKey) {
          endReferenceKeys.push(startFrameKey);
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
            if (!characterAppearance) {
              const appearanceConfig = character.appearance_config as Record<
                string,
                string
              > | null;
              if (appearanceConfig) {
                characterAppearance = {
                  gender: character.gender,
                  ageRange: character.age_range,
                  skinTone: appearanceConfig.skinTone,
                  hairColor: appearanceConfig.hairColor,
                  hairStyle: appearanceConfig.hairStyle,
                  eyeColor: appearanceConfig.eyeColor,
                  bodyType: appearanceConfig.bodyType,
                };
              }
            }
          }
        }

        const hasProductInEndFrame =
          includeProductImages &&
          productImageKeys &&
          productImageKeys.length > 0;
        if (hasProductInEndFrame) {
          endReferenceKeys.push(...productImageKeys.slice(0, 2));
        }

        const hasSupportingInEndFrame =
          supportingImageKeys && supportingImageKeys.length > 0;
        if (hasSupportingInEndFrame) {
          endReferenceKeys.push(...supportingImageKeys.slice(0, 2));
        }

        const endReferenceUrls = await getReferenceImageUrls(endReferenceKeys);
        const endPrompt = buildSceneImagePrompt(
          sceneData,
          true,
          hasProductInEndFrame,
          productName,
          userRefinement,
          "end",
          characterAppearance,
          hasSupportingInEndFrame,
        );

        const endResult = await falImageService.generateImageWithRetry({
          prompt: endPrompt,
          aspectRatio: "3:4",
          imageUrls: endReferenceUrls,
          usePro: true,
        });

        const endResponse = await fetch(endResult.imageUrl);
        if (!endResponse.ok) {
          throw new Error(
            `Failed to download end image from FAL: ${endResponse.status}`,
          );
        }

        const endBuffer = Buffer.from(await endResponse.arrayBuffer());
        const endImageKey = await s3Service.uploadSceneImage(
          endBuffer,
          teamId,
          scriptId,
          sceneId,
          1,
        );

        generatedImages.push(endImageKey);
      }
    }

    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message:
          generateEndFrame || customEndImageKey
            ? "Start and end frames generated"
            : "Scene image generated",
        generated_images: generatedImages,
        completed_at: new Date(),
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));
  } catch (error) {
    console.error(`[SCENE_IMAGE] Job ${jobId} failed:`, error);

    await db
      .update(schema.sceneImageGenerationJobs)
      .set({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date(),
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));
  }
}
