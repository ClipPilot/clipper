import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateSceneImageJob } from "../../services/sqs.service";
import { s3Service } from "../../services/s3.service";
import { falImageService } from "../../services/ai-ugc/falImage.service";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";
import { extractFrameAtTime } from "../../services/clips/videoEditor.service";
import {
  CharacterAppearance,
  ImagePositions,
  buildBRollShotPrompt,
  buildSceneImagePrompt,
} from "./sceneImagePrompts";
import { getReferenceImageUrls } from "../../utils/s3Helpers";
import path from "path";
import fs from "fs";
import os from "os";

const PRODUCT_VISIBLE_SCENE_TYPES = ["solution", "demo", "cta", "testimonial"];

function shouldIncludeProductImages(sceneType: string): boolean {
  return PRODUCT_VISIBLE_SCENE_TYPES.includes(sceneType.toLowerCase());
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

async function extractAndCacheVideoFrame(
  referenceVideoKey: string,
  sceneTimestamp: number,
  teamId: number,
  scriptId: string,
  sceneNumber: number
): Promise<string | null> {
  const cacheKey = `ad-clone-frames/${teamId}/${scriptId}/scene_${sceneNumber}_frame.jpg`;

  try {
    // Check S3 cache first
    const exists = await s3Service.objectExists(cacheKey);
    if (exists) {
      console.log(`[SCENE_IMAGE] Using cached video frame for scene ${sceneNumber}`);
      return cacheKey;
    }

    // Download video to temp file
    const tmpDir = os.tmpdir();
    const videoPath = path.join(tmpDir, `adclone_video_${teamId}_${Date.now()}.mp4`);
    const framePath = path.join(tmpDir, `adclone_frame_${teamId}_scene${sceneNumber}_${Date.now()}.jpg`);

    try {
      await s3Service.downloadFile(referenceVideoKey, videoPath);
      await extractFrameAtTime(videoPath, framePath, sceneTimestamp);

      const frameBuffer = fs.readFileSync(framePath);
      await s3Service.uploadBuffer(frameBuffer, cacheKey, "image/jpeg");

      console.log(`[SCENE_IMAGE] Extracted and cached video frame for scene ${sceneNumber} at ${sceneTimestamp.toFixed(1)}s`);
      return cacheKey;
    } finally {
      // Clean up temp files
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
    }
  } catch (error) {
    console.error(`[SCENE_IMAGE] Failed to extract video frame for scene ${sceneNumber}:`, error);
    return null;
  }
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
    isConsecutiveAroll,
    previousSceneSetting,
    adCloneReferenceVideoKey,
    adCloneSceneTimestamp,
    existingSceneImageKey,
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
      let characterNameForPrompt: string | undefined;

      if (characterId) {
        const [character] = await db
          .select()
          .from(schema.characters)
          .where(eq(schema.characters.id, characterId));

        if (character) {
          characterNameForPrompt = character.name ?? undefined;
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
          hasOriginal: false,
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
          characterNameForPrompt,
        );

        const result = await falImageService.generateImageWithRetry({
          prompt: shotPrompt,
          aspectRatio: "9:16",
          imageUrls: refs,
        });

        const response = await fetch(result.imageUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to download B-roll shot ${i + 1}: ${response.status}`,
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
      let hasVideoFrameReference = false;

      // For ad clone A-roll scenes, extract a frame from the original video as pose/composition reference
      if (adCloneReferenceVideoKey && adCloneSceneTimestamp !== undefined) {
        const videoFrameKey = await extractAndCacheVideoFrame(
          adCloneReferenceVideoKey,
          adCloneSceneTimestamp,
          teamId,
          scriptId,
          sceneNumber
        );
        if (videoFrameKey) {
          allReferenceKeys.push(videoFrameKey);
          hasVideoFrameReference = true;
          console.log(`[SCENE_IMAGE] Using reference video frame for pose/composition (scene ${sceneNumber})`);
        }
      }

      if (previousArollImageKey) {
        allReferenceKeys.push(previousArollImageKey);
        console.log(`[SCENE_IMAGE] Using previous A-roll image for visual consistency`);
      }

      // Include existing scene image as reference during regeneration
      if (existingSceneImageKey) {
        allReferenceKeys.push(existingSceneImageKey);
        console.log(`[SCENE_IMAGE] Using existing scene image for regeneration reference`);
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
        // Limit product images to 1 when video frame is present to stay within 5 reference image cap
        const maxProductImages = hasVideoFrameReference ? 1 : 2;
        allReferenceKeys.push(...productImageKeys.slice(0, maxProductImages));
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
        isConsecutiveAroll,
        previousSceneSetting,
        hasVideoFrameReference,
        !!existingSceneImageKey,
      );

      const startResult = await falImageService.generateImageWithRetry({
        prompt: startPrompt,
        aspectRatio: "9:16",
        imageUrls: refs,
      });

      const startResponse = await fetch(startResult.imageUrl);
      if (!startResponse.ok) {
        throw new Error(
          `Failed to download start image: ${startResponse.status}`,
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
          aspectRatio: "9:16",
          imageUrls: endReferenceUrls,
        });

        const endResponse = await fetch(endResult.imageUrl);
        if (!endResponse.ok) {
          throw new Error(
            `Failed to download end image: ${endResponse.status}`,
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
        error_message: sanitizeErrorForFrontend(error, "Image generation failed. Please try again."),
        completed_at: new Date(),
      })
      .where(eq(schema.sceneImageGenerationJobs.id, jobId));
  }
}
