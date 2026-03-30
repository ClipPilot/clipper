import { Request, Response } from "express";
import { db } from "../db";
import {
  sceneImageGenerationJobs,
  sceneImages,
  ugcScripts,
  characters,
  adCloneProjects,
  teamMembers,
} from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { sqsService } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { eq, and } from "drizzle-orm";
import { sanitizeErrorForFrontend } from "../utils/errorSanitizer";

interface AuthRequest extends Request {
  user?: { id: string; email: string; dbUserId: number };
}

interface ArollChainInfo {
  isPartOfChain: boolean;
  chainIndex: number;
  previousSceneIndex: number | null;
}

function detectArollChains(
  scenes: Array<{ sceneNumber: number; shotType?: string }>
): Map<number, ArollChainInfo> {
  const chainMap = new Map<number, ArollChainInfo>();

  if (scenes.length === 0) return chainMap;

  const indexedScenes = scenes.map((scene, idx) => ({
    ...scene,
    originalIndex: idx,
  }));

  indexedScenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  let chainIndex = 0;
  let previousArollIndex: number | null = null;

  for (const scene of indexedScenes) {
    const isAroll = scene.shotType === "a-roll" || scene.shotType === "a-roll-multi";

    if (isAroll) {
      if (previousArollIndex !== null) {
        chainMap.set(scene.originalIndex, {
          isPartOfChain: true,
          chainIndex: chainIndex,
          previousSceneIndex: previousArollIndex,
        });

        const prevInfo = chainMap.get(previousArollIndex);
        if (prevInfo && !prevInfo.isPartOfChain) {
          chainMap.set(previousArollIndex, {
            ...prevInfo,
            isPartOfChain: true,
          });
        }

        chainIndex++;
      } else {
        chainMap.set(scene.originalIndex, {
          isPartOfChain: false,
          chainIndex: 0,
          previousSceneIndex: null,
        });
        chainIndex = 1;
      }

      previousArollIndex = scene.originalIndex;
    } else {
      previousArollIndex = null;
      chainIndex = 0;
    }
  }

  return chainMap;
}

async function waitForJobCompletion(
  jobId: string,
  maxWaitMs: number = 300000, // 5 minutes max
  pollIntervalMs: number = 2000
): Promise<string | null> {
  const images = await waitForJobImages(jobId, maxWaitMs, pollIntervalMs);
  return images?.[0] || null;
}

async function waitForJobImages(
  jobId: string,
  maxWaitMs: number = 300000,
  pollIntervalMs: number = 2000
): Promise<string[] | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const [job] = await db
      .select()
      .from(sceneImageGenerationJobs)
      .where(eq(sceneImageGenerationJobs.id, jobId));

    if (!job) {
      console.error(`[SCENE_BUILDER] Job ${jobId} not found while polling`);
      return null;
    }

    if (job.status === "completed" && job.generated_images) {
      return job.generated_images as string[];
    }

    if (job.status === "failed") {
      console.error(`[SCENE_BUILDER] Job ${jobId} failed: ${job.error_message}`);
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  console.error(`[SCENE_BUILDER] Job ${jobId} timed out after ${maxWaitMs}ms`);
  return null;
}

interface BRollShotData {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
  shotType?: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
}

interface SceneData {
  id: string;
  sceneNumber: number;
  sceneType: string;
  action: string;
  dialogue: string;
  emotion: string;
  shotType: string;
  cameraAngle: string;
  cinematicPrompt: string;
  characterIndex?: number;
  bRollShots?: BRollShotData[] | null;
  arollShots?: Array<{
    characterIndex: number;
    action: string;
    dialogue: string;
    imageGenPrompt?: string;
    cinematicPrompt?: string;
    ambientSound?: string | null;
  }> | null;
}

export class SceneBuilderController {
  /**
   * Generate images for a single scene
   */
  async generateSceneImages(req: AuthRequest, res: Response) {
    try {
      const {
        teamId,
        scriptId,
        sceneId,
        sceneNumber,
        characterId,
        userRefinement,
        supportingImageKeys,
        generateEndFrame,
        customStartImageKey,
        customEndImageKey,
        singleBRollShotIndex,
        existingBRollImages,
        existingSceneImageKey,
      } = req.body;

      if (!teamId || !scriptId || !sceneId || sceneNumber === undefined || !characterId) {
        return res.status(400).json({
          error: "teamId, scriptId, sceneId, sceneNumber, and characterId are required",
        });
      }

      const isInternal = !!(req as any).isInternalRequest;
      if (!isInternal && !req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      // For internal requests, resolve a valid user ID from the team
      let userId: number = req.user?.dbUserId ?? 0;
      if (isInternal) {
        const [member] = await db
          .select({ user_id: teamMembers.user_id })
          .from(teamMembers)
          .where(eq(teamMembers.team_id, teamId))
          .limit(1);
        userId = member?.user_id;
        if (!userId) {
          return res.status(400).json({ error: "No team members found" });
        }
      }

      // First try ugcScripts table, then fall back to adCloneProjects
      let scriptsData: any[] | null = null;
      let selectedVariantIndex = 0;
      let productImageKeys: string[] = [];
      let productName: string | null = null;

      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, scriptId));

      let adCloneReferenceVideoKey: string | undefined;
      let adCloneVideoAnalysis: any = null;

      if (script) {
        scriptsData = script.scripts_data as any[];
        selectedVariantIndex = script.selected_variant_index;
        productImageKeys = (script.product_image_keys as string[]) || [];
        productName = script.product_name;
      } else {
        // Check if scriptId is actually an ad clone project ID
        const [adCloneProject] = await db
          .select()
          .from(adCloneProjects)
          .where(eq(adCloneProjects.id, scriptId));

        if (adCloneProject && adCloneProject.adapted_scripts) {
          scriptsData = adCloneProject.adapted_scripts as any[];
          selectedVariantIndex = adCloneProject.selected_variant_index ?? 0;
          productImageKeys = (adCloneProject.product_image_keys as string[]) || [];
          productName = adCloneProject.product_name;
          adCloneReferenceVideoKey = adCloneProject.reference_video_key || undefined;
          adCloneVideoAnalysis = adCloneProject.video_analysis;
        }
      }

      if (!scriptsData) {
        return res.status(404).json({ error: "Script not found" });
      }

      const selectedScript = scriptsData[selectedVariantIndex];
      const sceneData = selectedScript?.scenes?.find(
        (s: any) => s.id === sceneId || s.slug === sceneId
      ) as SceneData | undefined;

      if (!sceneData) {
        return res.status(404).json({ error: "Scene not found in script" });
      }

      const [existingImage] = await db
        .select()
        .from(sceneImages)
        .where(and(eq(sceneImages.script_id, scriptId), eq(sceneImages.scene_id, sceneId)))
        .limit(1);

      if (!existingImage) {
        const creditCost = 2;
        await teamService.incrementTeamUsage(teamId, creditCost);
        console.log(`[SCENE_BUILDER] Charged ${creditCost} credits to team ${teamId}`);
      }

      const prompt = this.buildScenePrompt(sceneData, userRefinement);

      let previousArollImageKey: string | undefined;
      let isConsecutiveAroll = false;
      let previousSceneSetting: string | undefined;

      if (sceneData.shotType === "a-roll" || sceneData.shotType === "a-roll-multi") {
        const allScenes = selectedScript?.scenes as SceneData[] || [];
        const previousScene = allScenes.find(
          (s: SceneData) => s.sceneNumber === sceneNumber - 1
        );

        if (previousScene?.shotType === "a-roll" || previousScene?.shotType === "a-roll-multi") {
          isConsecutiveAroll = true;
          previousSceneSetting = previousScene.cinematicPrompt;

          const [prevSceneImage] = await db
            .select()
            .from(sceneImages)
            .where(
              and(
                eq(sceneImages.script_id, scriptId),
                eq(sceneImages.scene_id, previousScene.id)
              )
            )
            .limit(1);

          if (prevSceneImage?.image_key) {
            previousArollImageKey = prevSceneImage.image_key;
            console.log(
              `[SCENE_BUILDER] Scene ${sceneNumber}: Consecutive A-roll - using previous image for consistency`
            );
          }
        }
      }

      const [job] = await db
        .insert(sceneImageGenerationJobs)
        .values({
          team_id: teamId,
          user_id: userId,
          script_id: scriptId,
          scene_id: sceneId,
          scene_number: sceneNumber,
          character_id: characterId,
          prompt,
          user_refinement: userRefinement || null,
          supporting_image_keys: supportingImageKeys || [],
          status: "queued",
          progress: 0,
          progress_message: "Queued for generation...",
        })
        .returning();

      // Compute ad clone scene timestamp for A-roll scenes
      let adCloneSceneTimestamp: number | undefined;
      if (adCloneReferenceVideoKey && adCloneVideoAnalysis?.scenes && (sceneData.shotType === "a-roll" || sceneData.shotType === "a-roll-multi")) {
        const analysisScene = adCloneVideoAnalysis.scenes.find((s: any) => s.sceneNumber === sceneNumber);
        if (analysisScene) {
          adCloneSceneTimestamp = (analysisScene.startTime + analysisScene.endTime) / 2;
        }
      }

      await sqsService.sendGenerateSceneImageJob({
        jobId: job.id,
        teamId,
        userId,
        scriptId,
        sceneId,
        sceneNumber,
        characterId,
        sceneData: {
          sceneType: sceneData.sceneType,
          action: sceneData.action,
          dialogue: sceneData.dialogue,
          emotion: sceneData.emotion,
          shotType: sceneData.shotType,
          cameraAngle: sceneData.cameraAngle,
          cinematicPrompt: sceneData.cinematicPrompt,
        },
        productImageKeys,
        productName: productName || undefined,
        userRefinement: userRefinement || undefined,
        supportingImageKeys: supportingImageKeys || [],
        generateEndFrame: generateEndFrame || false,
        customStartImageKey: customStartImageKey || undefined,
        customEndImageKey: customEndImageKey || undefined,
        bRollShots: sceneData.bRollShots || undefined,
        arollShots: sceneData.arollShots || undefined,
        singleBRollShotIndex,
        existingBRollImages: existingBRollImages || undefined,
        previousArollImageKey,
        isConsecutiveAroll,
        previousSceneSetting,
        adCloneReferenceVideoKey,
        adCloneSceneTimestamp,
        existingSceneImageKey: existingSceneImageKey || undefined,
      });

      return res.status(202).json({
        success: true,
        jobId: job.id,
        sceneId,
        status: "queued",
        singleBRollShotIndex: singleBRollShotIndex ?? null,
        message: singleBRollShotIndex !== undefined
          ? `Regenerating shot ${singleBRollShotIndex + 1}. Poll for status.`
          : "Scene image generation started. Poll for status.",
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Generate scene images error:", error);
      return res.status(500).json({
        error:
          sanitizeErrorForFrontend(error, "Failed to queue generation"),
      });
    }
  }

  /**
   * Generate images for all scenes in a script (batch)
   */
  async generateAllSceneImages(req: AuthRequest, res: Response) {
    try {
      const { teamId, scriptId, characterId, scenes } = req.body as {
        teamId: number;
        scriptId: string;
        characterId: number;
        scenes: Array<{
          sceneId: string;
          sceneNumber: number;
          // Scene content passed from frontend (preferred - avoids stale DB reads)
          sceneType?: string;
          dialogue?: string;
          action?: string;
          emotion?: string;
          shotType?: string;
          cameraAngle?: string;
          cinematicPrompt?: string;
          characterIndex?: number;
          // Optional refinements
          userRefinement?: string;
          supportingImageKeys?: string[];
          generateEndFrame?: boolean;
          customStartImageKey?: string;
          customEndImageKey?: string;
          bRollShots?: BRollShotData[];
          arollShots?: Array<{
            characterIndex: number;
            action: string;
            dialogue: string;
            cinematicPrompt?: string;
            ambientSound?: string | null;
          }>;
        }>;
      };

      if (!teamId || !scriptId || !characterId || !scenes?.length) {
        return res.status(400).json({
          error: "teamId, scriptId, characterId, and scenes array are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      // Fetch script from DB as fallback (only used if scene data not passed)
      // First try ugcScripts table, then fall back to adCloneProjects
      let scriptsData: any[] | null = null;
      let selectedVariantIndex = 0;
      let productImageKeys: string[] = [];
      let productName: string | null = null;

      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, scriptId));

      let adCloneReferenceVideoKey: string | undefined;
      let adCloneVideoAnalysis: any = null;

      if (script) {
        scriptsData = script.scripts_data as any[];
        selectedVariantIndex = script.selected_variant_index;
        productImageKeys = (script.product_image_keys as string[]) || [];
        productName = script.product_name;
      } else {
        // Check if scriptId is actually an ad clone project ID
        const [adCloneProject] = await db
          .select()
          .from(adCloneProjects)
          .where(eq(adCloneProjects.id, scriptId));

        if (adCloneProject && adCloneProject.adapted_scripts) {
          scriptsData = adCloneProject.adapted_scripts as any[];
          selectedVariantIndex = adCloneProject.selected_variant_index ?? 0;
          productImageKeys = (adCloneProject.product_image_keys as string[]) || [];
          productName = adCloneProject.product_name;
          adCloneReferenceVideoKey = adCloneProject.reference_video_key || undefined;
          adCloneVideoAnalysis = adCloneProject.video_analysis;
        }
      }

      if (!scriptsData) {
        return res.status(404).json({ error: "Script not found" });
      }

      const selectedScript = scriptsData[selectedVariantIndex];

      const charactersConfig = script?.characters_config as Array<{ characterId: number; voiceId?: string }> | null;

      const jobIds: string[] = [];
      const BATCH_SIZE = 2;
      const DELAY_BETWEEN_BATCHES_MS = 1000;

      // Separate a-roll-multi scenes from the rest
      const arollMultiIndices: number[] = [];
      const otherIndices: number[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const shotType = scenes[i].shotType || selectedScript?.scenes?.find((s: SceneData) => s.id === scenes[i].sceneId)?.shotType;
        if (shotType === "a-roll-multi") {
          arollMultiIndices.push(i);
        } else {
          otherIndices.push(i);
        }
      }

      // Detect A-roll chains for non-multi scenes (regular a-roll chaining)
      const arollChains = detectArollChains(
        otherIndices.map((i) => scenes[i]),
      );
      // Remap chain indices back to original scene indices
      const remappedChains = new Map<number, ArollChainInfo>();
      for (const [localIdx, info] of arollChains.entries()) {
        const origIdx = otherIndices[localIdx];
        remappedChains.set(origIdx, {
          ...info,
          previousSceneIndex: info.previousSceneIndex !== null ? otherIndices[info.previousSceneIndex] : null,
        });
      }

      // Track generated image keys for A-roll chaining (non-multi scenes)
      const generatedImageKeys: Map<number, string> = new Map();

      // Helper: resolve scene data for a given index
      const resolveSceneData = (idx: number): { sceneData: SceneData; sceneCharacterId: number } | null => {
        const sceneRequest = scenes[idx];
        const dbSceneData = selectedScript?.scenes?.find(
          (s: SceneData) => s.id === sceneRequest.sceneId
        ) as SceneData | undefined;

        let sceneData: SceneData;
        if (sceneRequest.sceneType && sceneRequest.dialogue !== undefined && sceneRequest.action && sceneRequest.emotion) {
          sceneData = {
            id: sceneRequest.sceneId,
            sceneNumber: sceneRequest.sceneNumber,
            sceneType: sceneRequest.sceneType,
            dialogue: sceneRequest.dialogue,
            action: sceneRequest.action,
            emotion: sceneRequest.emotion,
            shotType: sceneRequest.shotType || "a-roll",
            cameraAngle: sceneRequest.cameraAngle || "pov-selfie",
            cinematicPrompt: sceneRequest.cinematicPrompt || dbSceneData?.cinematicPrompt || "",
            bRollShots: sceneRequest.bRollShots || dbSceneData?.bRollShots || null,
            arollShots: sceneRequest.arollShots || (dbSceneData as any)?.arollShots || null,
          } as SceneData;
        } else if (dbSceneData) {
          sceneData = dbSceneData;
        } else {
          return null;
        }

        const dbSceneCharIndex = dbSceneData?.characterIndex;
        const sceneCharIndex = sceneRequest.characterIndex ?? dbSceneCharIndex;
        const sceneCharacterId = (sceneCharIndex !== undefined && charactersConfig)
          ? charactersConfig[sceneCharIndex]?.characterId ?? characterId
          : characterId;

        return { sceneData, sceneCharacterId };
      };

      // Helper: create DB job + dispatch to SQS
      const dispatchScene = async (
        idx: number,
        extra: {
          previousArollImageKey?: string;
          isConsecutiveAroll?: boolean;
          previousSceneSetting?: string;
          settingAnchorKeys?: string[];
        } = {},
      ): Promise<string | null> => {
        const sceneRequest = scenes[idx];
        const resolved = resolveSceneData(idx);
        if (!resolved) {
          console.warn(`[SCENE_BUILDER] Scene ${sceneRequest.sceneId} not found, skipping`);
          return null;
        }
        const { sceneData, sceneCharacterId } = resolved;

        const prompt = this.buildScenePrompt(sceneData, sceneRequest.userRefinement);

        const [job] = await db
          .insert(sceneImageGenerationJobs)
          .values({
            team_id: teamId,
            user_id: req.user!.dbUserId,
            script_id: scriptId,
            scene_id: sceneRequest.sceneId,
            scene_number: sceneRequest.sceneNumber,
            character_id: sceneCharacterId,
            prompt,
            user_refinement: sceneRequest.userRefinement || null,
            supporting_image_keys: sceneRequest.supportingImageKeys || [],
            status: "queued",
            progress: 0,
            progress_message: "Queued for generation...",
          })
          .returning();

        let adCloneSceneTimestamp: number | undefined;
        if (adCloneReferenceVideoKey && adCloneVideoAnalysis?.scenes && (sceneData.shotType === "a-roll" || sceneData.shotType === "a-roll-multi")) {
          const analysisScene = adCloneVideoAnalysis.scenes.find((s: any) => s.sceneNumber === sceneRequest.sceneNumber);
          if (analysisScene) {
            adCloneSceneTimestamp = (analysisScene.startTime + analysisScene.endTime) / 2;
          }
        }

        await sqsService.sendGenerateSceneImageJob({
          jobId: job.id,
          teamId,
          userId: req.user!.dbUserId,
          scriptId,
          sceneId: sceneRequest.sceneId,
          sceneNumber: sceneRequest.sceneNumber,
          characterId: sceneCharacterId,
          sceneData: {
            sceneType: sceneData.sceneType,
            action: sceneData.action,
            dialogue: sceneData.dialogue,
            emotion: sceneData.emotion,
            shotType: sceneData.shotType,
            cameraAngle: sceneData.cameraAngle,
            cinematicPrompt: sceneData.cinematicPrompt,
          },
          productImageKeys,
          productName: productName || undefined,
          userRefinement: sceneRequest.userRefinement,
          supportingImageKeys: sceneRequest.supportingImageKeys || [],
          generateEndFrame: sceneRequest.generateEndFrame || false,
          customStartImageKey: sceneRequest.customStartImageKey || undefined,
          customEndImageKey: sceneRequest.customEndImageKey || undefined,
          bRollShots: sceneData.bRollShots || undefined,
          arollShots: sceneData.arollShots || undefined,
          previousArollImageKey: extra.previousArollImageKey,
          isConsecutiveAroll: extra.isConsecutiveAroll,
          previousSceneSetting: extra.previousSceneSetting,
          settingAnchorKeys: extra.settingAnchorKeys,
          adCloneReferenceVideoKey,
          adCloneSceneTimestamp,
        });

        return job.id;
      };

      // ===== PHASE 1: Dispatch a-roll-multi scenes with anchor pattern =====
      let settingAnchorKeys: string[] | undefined;

      if (arollMultiIndices.length > 0) {
        // Dispatch FIRST a-roll-multi scene (establishes the setting)
        const firstIdx = arollMultiIndices[0];
        const firstJobId = await dispatchScene(firstIdx);
        if (firstJobId) {
          jobIds.push(firstJobId);

          console.log(
            `[SCENE_BUILDER] A-roll-multi anchor scene ${scenes[firstIdx].sceneNumber}: Waiting for completion to establish setting...`,
          );
          const anchorImages = await waitForJobImages(firstJobId);
          if (anchorImages && anchorImages.length >= 2) {
            settingAnchorKeys = [anchorImages[0], anchorImages[1]];
            console.log(
              `[SCENE_BUILDER] Setting anchors established: ${settingAnchorKeys.length} images from scene ${scenes[firstIdx].sceneNumber}`,
            );
          } else if (anchorImages && anchorImages.length === 1) {
            settingAnchorKeys = [anchorImages[0]];
            console.warn(`[SCENE_BUILDER] Only 1 anchor image from scene ${scenes[firstIdx].sceneNumber}`);
          } else {
            console.warn(`[SCENE_BUILDER] Anchor scene failed or timed out, remaining a-roll-multi scenes will generate without setting anchors`);
          }
        }

        // Dispatch REMAINING a-roll-multi scenes in parallel with anchor keys
        if (arollMultiIndices.length > 1) {
          const remainingJobs = await Promise.all(
            arollMultiIndices.slice(1).map((idx) =>
              dispatchScene(idx, { settingAnchorKeys }),
            ),
          );
          for (const jid of remainingJobs) {
            if (jid) jobIds.push(jid);
          }
          console.log(
            `[SCENE_BUILDER] Dispatched ${remainingJobs.filter(Boolean).length} remaining a-roll-multi scenes in parallel`,
          );
        }
      }

      // ===== PHASE 2: Dispatch non-a-roll-multi scenes with existing chain logic =====
      for (let localIdx = 0; localIdx < otherIndices.length; localIdx++) {
        const idx = otherIndices[localIdx];
        const jobId = await dispatchScene(idx, (() => {
          const chainInfo = remappedChains.get(idx);
          if (!chainInfo?.isPartOfChain || chainInfo.previousSceneIndex === null) return {};

          const prevIdx = chainInfo.previousSceneIndex;
          const prevSceneRequest = scenes[prevIdx];
          const prevDbSceneData = selectedScript?.scenes?.find(
            (s: SceneData) => s.id === prevSceneRequest.sceneId
          ) as SceneData | undefined;

          return {
            previousArollImageKey: generatedImageKeys.get(prevIdx),
            isConsecutiveAroll: true,
            previousSceneSetting: prevSceneRequest.cinematicPrompt || prevDbSceneData?.cinematicPrompt,
          };
        })());

        if (!jobId) continue;
        jobIds.push(jobId);

        // Check if next non-multi scene needs this one to complete first
        const nextLocalIdx = localIdx + 1;
        if (nextLocalIdx < otherIndices.length) {
          const nextOrigIdx = otherIndices[nextLocalIdx];
          const nextChainInfo = remappedChains.get(nextOrigIdx);
          if (nextChainInfo?.isPartOfChain && nextChainInfo.previousSceneIndex === idx) {
            console.log(
              `[SCENE_BUILDER] Scene ${scenes[idx].sceneNumber}: Waiting for completion (next scene needs this as reference)...`,
            );
            const generatedKey = await waitForJobCompletion(jobId);
            if (generatedKey) {
              generatedImageKeys.set(idx, generatedKey);
            }
            continue;
          }
        }

        if ((localIdx + 1) % BATCH_SIZE === 0 && localIdx < otherIndices.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
        }
      }

      return res.status(202).json({
        success: true,
        jobIds,
        message: `${jobIds.length} scene image generation jobs queued.`,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Generate all scene images error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue batch generation",
      });
    }
  }

  /**
   * Get generation status for a job
   */
  async getGenerationStatus(req: AuthRequest, res: Response) {
    try {
      const jobId = req.params.jobId;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const [job] = await db
        .select()
        .from(sceneImageGenerationJobs)
        .where(eq(sceneImageGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const response: any = {
        success: true,
        jobId: job.id,
        sceneId: job.scene_id,
        sceneNumber: job.scene_number,
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      };

      if (job.status === "completed" && job.generated_images) {
        const imageKeys = job.generated_images as string[];
        const imageUrls = await Promise.all(
          imageKeys.map((key) => s3Service.getPresignedUrl(key, 3600))
        );

        response.images = imageKeys.map((key, i) => {
          const variantMatch = key.match(/variant_(\d+)/);
          const frameIndex = variantMatch ? parseInt(variantMatch[1], 10) : i;
          return {
            key,
            url: imageUrls[i],
            index: frameIndex,
          };
        });
      }

      if (job.status === "failed") {
        response.error = job.error_message;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error("[SCENE_BUILDER] Get generation status error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to get status"),
      });
    }
  }

  /**
   * Get all scene images for a script
   */
  async getSceneImages(req: AuthRequest, res: Response) {
    try {
      const scriptId = req.params.scriptId;

      if (!scriptId) {
        return res.status(400).json({ error: "scriptId is required" });
      }

      const images = await db
        .select()
        .from(sceneImages)
        .where(eq(sceneImages.script_id, scriptId));

      // Also get the generation jobs to retrieve generatedImages for B-roll scenes
      const jobs = await db
        .select()
        .from(sceneImageGenerationJobs)
        .where(eq(sceneImageGenerationJobs.script_id, scriptId));

      // Create a map of sceneId -> latest completed job
      const latestJobsByScene: Record<string, typeof jobs[0]> = {};
      for (const job of jobs) {
        if (job.status === "completed" && job.generated_images) {
          const existing = latestJobsByScene[job.scene_id];
          if (!existing || (job.completed_at && existing.completed_at && job.completed_at > existing.completed_at)) {
            latestJobsByScene[job.scene_id] = job;
          }
        }
      }

      const imagesWithUrls = await Promise.all(
        images.map(async (img) => {
          const job = latestJobsByScene[img.scene_id];
          const generatedImageKeys = job?.generated_images as string[] | undefined;

          // Get presigned URLs for all generated images (for B-roll scenes with multiple shots)
          let generatedImages: { key: string; url: string; index: number }[] | undefined;
          if (generatedImageKeys && generatedImageKeys.length >= 1) {
            generatedImages = await Promise.all(
              generatedImageKeys.map(async (key, index) => ({
                key,
                url: await s3Service.getPresignedUrl(key, 3600),
                index,
              }))
            );
          }

          return {
            ...img,
            imageUrl: await s3Service.getPresignedUrl(img.image_key, 3600),
            generatedImages,
          };
        })
      );

      const sceneImagesMap: Record<string, any> = {};
      for (const img of imagesWithUrls) {
        sceneImagesMap[img.scene_id] = img;
      }

      return res.status(200).json({
        success: true,
        sceneImages: sceneImagesMap,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Get scene images error:", error);
      return res.status(500).json({
        error:
          sanitizeErrorForFrontend(error, "Failed to get scene images"),
      });
    }
  }

  /**
   * Select/save an image for a scene
   */
  async selectSceneImage(req: AuthRequest, res: Response) {
    try {
      const { scriptId, sceneId, sceneNumber, imageKey, generationJobId } =
        req.body;

      if (!scriptId || !sceneId || !imageKey || sceneNumber === undefined) {
        return res.status(400).json({
          error: "scriptId, sceneId, sceneNumber, and imageKey are required",
        });
      }

      const [existing] = await db
        .select()
        .from(sceneImages)
        .where(
          and(
            eq(sceneImages.script_id, scriptId),
            eq(sceneImages.scene_id, sceneId)
          )
        );

      if (existing) {
        const [updated] = await db
          .update(sceneImages)
          .set({
            image_key: imageKey,
            generation_job_id: generationJobId || null,
            updated_at: new Date(),
          })
          .where(eq(sceneImages.id, existing.id))
          .returning();

        return res.status(200).json({
          success: true,
          sceneImage: updated,
        });
      } else {
        const [created] = await db
          .insert(sceneImages)
          .values({
            script_id: scriptId,
            scene_id: sceneId,
            scene_number: sceneNumber,
            image_key: imageKey,
            generation_job_id: generationJobId || null,
          })
          .returning();

        return res.status(201).json({
          success: true,
          sceneImage: created,
        });
      }
    } catch (error) {
      console.error("[SCENE_BUILDER] Select scene image error:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to select scene image",
      });
    }
  }

  /**
   * Cancel a stuck or generating job - allows user to retry
   */
  async cancelJob(req: AuthRequest, res: Response) {
    try {
      const jobId = req.params.jobId;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const [job] = await db
        .select()
        .from(sceneImageGenerationJobs)
        .where(eq(sceneImageGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status === "completed") {
        return res.status(400).json({ error: "Cannot cancel a completed job" });
      }

      await db
        .update(sceneImageGenerationJobs)
        .set({
          status: "failed",
          error_message: "Cancelled by user",
          completed_at: new Date(),
        })
        .where(eq(sceneImageGenerationJobs.id, jobId));

      return res.status(200).json({
        success: true,
        message: "Job cancelled successfully",
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Cancel job error:", error);
      return res.status(500).json({
        error: sanitizeErrorForFrontend(error, "Failed to cancel job"),
      });
    }
  }

  /**
   * Get presigned upload URL for supporting images
   */
  async getUploadUrl(req: AuthRequest, res: Response) {
    try {
      const { teamId, fileName } = req.body;

      if (!teamId || !fileName) {
        return res
          .status(400)
          .json({ error: "teamId and fileName are required" });
      }

      const { uploadUrl, s3Key } =
        await s3Service.getSceneImagePresignedUpload(teamId, fileName);

      return res.status(200).json({
        success: true,
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Get upload URL error:", error);
      return res.status(500).json({
        error:
          sanitizeErrorForFrontend(error, "Failed to get upload URL"),
      });
    }
  }

  /**
   * Get presigned upload URL for replacing an existing image (e.g., custom B-roll)
   * This allows uploading to a specific S3 key to replace the generated image
   */
  async getUploadUrlForKey(req: AuthRequest, res: Response) {
    try {
      const { s3Key, contentType } = req.body;

      if (!s3Key) {
        return res.status(400).json({ error: "s3Key is required" });
      }

      const uploadUrl = await s3Service.getPresignedUploadUrlForKey(
        s3Key,
        contentType || "image/jpeg"
      );

      return res.status(200).json({
        success: true,
        uploadUrl,
        s3Key,
      });
    } catch (error) {
      console.error("[SCENE_BUILDER] Get upload URL for key error:", error);
      return res.status(500).json({
        error:
          sanitizeErrorForFrontend(error, "Failed to get upload URL"),
      });
    }
  }

  /**
   * Build the scene image prompt using cinematicPrompt from script
   */
  private buildScenePrompt(
    sceneData: SceneData,
    userRefinement?: string
  ): string {
    const parts: string[] = [
      "REFERENCE IMAGES PROVIDED: Use the character reference image to maintain consistent identity. This must be the EXACT SAME person.",
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
      "- Photorealistic, UGC/iPhone aesthetic",
      "- Vertical 3:4 aspect ratio",
      "- Natural lighting",
      `- Expression matches emotion: ${sceneData.emotion}`,
      "",
      "NEGATIVE: Cartoon, illustration, watermarks, text overlays, deformed features"
    );

    return parts.join("\n");
  }
}

export const sceneBuilderController = new SceneBuilderController();
