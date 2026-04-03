import { Request, Response } from "express";
import type { ErrorResponse } from "../types/api.types";
import path from "path";
import fs from "fs";
import { db } from "../db";
import {
  ugcVideoGenerationJobs,
  ugcScripts,
  sceneImages,
  sceneImageGenerationJobs,
  clips,
} from "@clipper/shared-db/src/schema";
import { s3Service } from "../services/s3.service";
import { sqsService, GenerateUGCVideoJob } from "../services/sqs.service";
import { teamService } from "../services/team.service";
import { canAccessUGCStudio } from "../utils/plans";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { transcribeVideoService } from "../services/clips/transcription.service";
import { convertWordsToCaptionEntries, CaptionEntry } from "../services/clips/captions.service";
import { getTeamUsage } from "../middleware/subscription.middleware";
import { handleControllerError } from "../utils/controllerHelpers";
import { ugcScriptService, detectSilentMode } from "../services/ai-ugc/ugcScript.service";
import type { ShotType } from "../types/ugcScript.types";
import { AuthRequest } from "../middleware/auth.middleware";
import { INSUFFICIENT_CREDITS } from "../constants/errorCodes";

interface BRollShotData {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
}

interface ArollShotData {
  dialogue: string;
  action: string;
  emotion: string;
  characterIndex: number;
  ambientSound?: string | null;
  cinematicPrompt?: string;
}

interface SceneData {
  id: string;
  sceneNumber: number;
  sceneType: string;
  action: string;
  dialogue: string;
  emotion: string;
  shotType: ShotType;
  cameraAngle: string;
  cinematicPrompt: string;
  durationSeconds: number;
  ambientSound?: string | null;
  bRollShots?: BRollShotData[] | null;
  arollShots?: ArollShotData[] | null;
}

export class UGCVideoController {
  /**
   * List video generation jobs for a team with pagination
   */
  async listVideoJobs(req: AuthRequest, res: Response<{ jobs: any[]; total: number; limit: number; offset: number } | ErrorResponse>) {
    try {
      const teamId = parseInt(req.query.teamId as string, 10);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (!teamId) {
        return res.status(400).json({ error: "teamId is required" });
      }

      const jobs = await db
        .select({
          id: ugcVideoGenerationJobs.id,
          scriptId: ugcVideoGenerationJobs.script_id,
          status: ugcVideoGenerationJobs.status,
          progress: ugcVideoGenerationJobs.progress,
          progressMessage: ugcVideoGenerationJobs.progress_message,
          finalVideoKey: ugcVideoGenerationJobs.final_video_key,
          totalDurationSeconds: ugcVideoGenerationJobs.total_duration_seconds,
          errorMessage: ugcVideoGenerationJobs.error_message,
          createdAt: ugcVideoGenerationJobs.created_at,
          completedAt: ugcVideoGenerationJobs.completed_at,
          scriptsData: ugcScripts.scripts_data,
          selectedVariantIndex: ugcScripts.selected_variant_index,
          productName: ugcScripts.product_name,
        })
        .from(ugcVideoGenerationJobs)
        .leftJoin(ugcScripts, eq(ugcVideoGenerationJobs.script_id, ugcScripts.id))
        .where(eq(ugcVideoGenerationJobs.team_id, teamId))
        .orderBy(desc(ugcVideoGenerationJobs.created_at))
        .limit(limit)
        .offset(offset);

      // Get clip IDs for completed jobs (to track finalized videos)
      const completedJobIds = jobs.filter(j => j.status === "completed").map(j => j.id);
      const clipsByJobId: Record<string, number> = {};

      if (completedJobIds.length > 0) {
        const clipsForJobs = await db
          .select({
            id: clips.id,
            clipMetadata: clips.clip_metadata,
          })
          .from(clips)
          .where(sql`${clips.clip_metadata}->>'generationJobId' IN ${completedJobIds}`);

        for (const clip of clipsForJobs) {
          const metadata = clip.clipMetadata as { generationJobId?: string } | null;
          if (metadata?.generationJobId) {
            clipsByJobId[metadata.generationJobId] = clip.id;
          }
        }
      }

      const [countResult] = await db
        .select({ count: count() })
        .from(ugcVideoGenerationJobs)
        .where(eq(ugcVideoGenerationJobs.team_id, teamId));

      // Get thumbnails for each job (first scene image per script)
      const scriptIds = [...new Set(jobs.map((j) => j.scriptId))];
      const thumbnails: Record<string, string> = {};

      if (scriptIds.length > 0) {
        const firstSceneImages = await db
          .select({
            scriptId: sceneImages.script_id,
            imageKey: sceneImages.image_key,
          })
          .from(sceneImages)
          .where(sql`${sceneImages.script_id} IN ${scriptIds}`)
          .orderBy(sceneImages.scene_number);

        // Keep only first image per script
        for (const img of firstSceneImages) {
          if (!thumbnails[img.scriptId]) {
            thumbnails[img.scriptId] = img.imageKey;
          }
        }
      }

      // Generate presigned URLs
      const jobsWithUrls = await Promise.all(
        jobs.map(async (job) => {
          // Extract title from script data
          let scriptTitle = job.productName || "Untitled Video";
          if (job.scriptsData && Array.isArray(job.scriptsData)) {
            const selectedScript = job.scriptsData[job.selectedVariantIndex || 0] as any;
            if (selectedScript?.title) {
              scriptTitle = selectedScript.title;
            }
          }

          const result: any = {
            id: job.id,
            scriptId: job.scriptId,
            scriptTitle,
            status: job.status,
            progress: job.progress,
            progressMessage: job.progressMessage,
            totalDurationSeconds: job.totalDurationSeconds,
            errorMessage: job.errorMessage,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
            clipId: clipsByJobId[job.id] || null,
          };

          // Add video URL for completed jobs
          if (job.status === "completed" && job.finalVideoKey) {
            result.finalVideoUrl = await s3Service.getPresignedUrl(
              job.finalVideoKey,
              3600
            );
          }

          // Add thumbnail URL
          const thumbnailKey = thumbnails[job.scriptId];
          if (thumbnailKey) {
            result.thumbnailUrl = await s3Service.getPresignedUrl(
              thumbnailKey,
              3600
            );
          }

          return result;
        })
      );

      return res.status(200).json({
        jobs: jobsWithUrls,
        total: countResult?.count || 0,
        limit,
        offset,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_VIDEO] List jobs error", error, "Failed to list video jobs");
    }
  }

  /**
   * Generate a UGC video from a script
   * Queues a background job that processes all scenes
   */
  async generateVideo(req: AuthRequest, res: Response<{ success: boolean; jobId: string; status: string; message: string } | ErrorResponse | { error: string; code: string; required: number; available: number }>) {
    try {
      const { teamId, scriptId, voiceId, voiceConfig, isSilent: requestSilent } = req.body;

      if (!teamId || !scriptId) {
        return res.status(400).json({
          error: "teamId and scriptId are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const team = await teamService.getTeamById(teamId);
      if (!team || !canAccessUGCStudio(team.plan)) {
        return res.status(403).json({ error: "UGC Studio access required" });
      }

      // Fetch the script to get scene data
      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, scriptId));

      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }

      if (script.status !== "completed") {
        return res.status(400).json({
          error: "Script generation must be completed before video generation",
        });
      }

      // Get the selected script variant
      const scriptsData = script.scripts_data as any[];
      const selectedScript = scriptsData[script.selected_variant_index];

      if (!selectedScript?.scenes?.length) {
        return res.status(400).json({
          error: "No scenes found in the selected script variant",
        });
      }

      // Detect silent mode from structure/pattern OR explicit frontend flag
      const isSilent = !!requestSilent || detectSilentMode(
        script.structure_id || "",
        script.custom_pattern as { type: string; shot: string }[] | null,
      );

      const hasVoiceConfig = Array.isArray(voiceConfig) && voiceConfig.length > 0;
      if (!isSilent && !voiceId && !hasVoiceConfig) {
        return res.status(400).json({
          error: "voiceId or voiceConfig is required for non-silent videos",
        });
      }

      // Calculate credit cost (2 credits per original scene/shot)
      // Merged a-rolls count individually, a-roll-multi shots count individually
      const CREDIT_PER_SCENE = 2;
      const sceneCount = selectedScript.scenes.reduce((count: number, scene: any) => {
        if (scene.shotType === "a-roll-multi" && scene.arollShots?.length) {
          return count + scene.arollShots.length;
        }
        return count + (scene.mergedSceneTypes?.length || 1);
      }, 0);
      const creditCost = sceneCount * CREDIT_PER_SCENE;

      const usage = await getTeamUsage(teamId);
      if (!usage) {
        return res.status(404).json({ error: "Team usage stats not found" });
      }
      if (usage.totalRemaining < creditCost) {
        return res.status(403).json({
          error: `Insufficient credits. This video (${sceneCount} scenes) requires ${creditCost} credits, but you have ${usage.totalRemaining} remaining.`,
          code: INSUFFICIENT_CREDITS,
          required: creditCost,
          available: usage.totalRemaining,
        });
      }

      // Fetch all scene images for this script
      const savedImages = await db
        .select()
        .from(sceneImages)
        .where(eq(sceneImages.script_id, scriptId));

      await Promise.all(
        (selectedScript.scenes as SceneData[]).map(async (scene) => {
          const promises: Promise<void>[] = [
            ugcScriptService.regenerateCinematicPrompt(scene.action)
              .then((p) => { scene.cinematicPrompt = p; }),
          ];
          for (const shot of scene.bRollShots || []) {
            promises.push(
              ugcScriptService.regenerateCinematicPrompt(shot.action)
                .then((p) => { shot.cinematicPrompt = p; })
            );
          }
          await Promise.all(promises);
        })
      );

      await db
        .update(ugcScripts)
        .set({ scripts_data: scriptsData, updated_at: new Date() })
        .where(eq(ugcScripts.id, scriptId));
      const scenes: GenerateUGCVideoJob["scenes"] = [];

      const charactersConfig = script.characters_config as Array<{ characterId: number; voiceId: string }> | null;
      const validatedVoiceConfig = Array.isArray(voiceConfig)
        ? voiceConfig.filter(
            (v: unknown): v is { characterId: number; voiceId: string } =>
              typeof v === "object" && v !== null &&
              typeof (v as any).characterId === "number" &&
              typeof (v as any).voiceId === "string" && (v as any).voiceId.length > 0,
          )
        : undefined;
      const effectiveVoiceConfig = (validatedVoiceConfig && validatedVoiceConfig.length > 0 ? validatedVoiceConfig : undefined)
        || charactersConfig
        || null;

      for (const scene of selectedScript.scenes as (SceneData & { slug?: string; characterIndex?: number })[]) {
        const sceneId = scene.id || scene.slug;
        const savedImage = savedImages.find((img) => img.scene_id === sceneId);

        if (!savedImage) {
          return res.status(400).json({
            error: `No image selected for scene ${scene.sceneNumber}. Please select images for all scenes first.`,
          });
        }

        let sceneVoiceId: string | undefined;
        if (scene.characterIndex !== undefined && effectiveVoiceConfig) {
          sceneVoiceId = effectiveVoiceConfig[scene.characterIndex]?.voiceId;
        }
        if (!sceneVoiceId && voiceId) {
          sceneVoiceId = voiceId;
        }

        const sceneData: GenerateUGCVideoJob["scenes"][number] = {
          sceneId: sceneId!,
          sceneNumber: scene.sceneNumber,
          shotType: scene.shotType,
          imageKey: savedImage.image_key,
          dialogue: scene.dialogue,
          duration: scene.durationSeconds || (scene as any).duration || 5,
          cinematicPrompt: scene.cinematicPrompt,
          action: scene.action,
          emotion: scene.emotion,
          ambientSound: scene.ambientSound,
          voiceId: sceneVoiceId,
        };

        if (scene.bRollShots && scene.bRollShots.length > 0 && scene.shotType === "b-roll") {
          // Look up per-shot keys from the generation job
          let shotKeys: string[] | undefined;
          if (savedImage.generation_job_id) {
            const [job] = await db
              .select({ generated_images: sceneImageGenerationJobs.generated_images })
              .from(sceneImageGenerationJobs)
              .where(eq(sceneImageGenerationJobs.id, savedImage.generation_job_id))
              .limit(1);
            if (job?.generated_images) {
              shotKeys = job.generated_images as string[];
            }
          }

          sceneData.bRollShots = scene.bRollShots.map((shot, index) => {
            const shotImageKey = shotKeys?.[index] || savedImage.image_key;

            return {
              action: shot.action,
              cinematicPrompt: shot.cinematicPrompt,
              durationSeconds: shot.durationSeconds,
              imageKey: shotImageKey,
            };
          });

          console.log(
            `[UGC_VIDEO] Scene ${scene.sceneNumber}: Built ${sceneData.bRollShots.length}-shot montage with keys:`,
            sceneData.bRollShots.map((s) => s.imageKey)
          );
        }

        if (scene.arollShots && scene.arollShots.length > 0 && scene.shotType === "a-roll-multi") {
          let shotKeys: string[] | undefined;
          if (savedImage.generation_job_id) {
            const [job] = await db
              .select({ generated_images: sceneImageGenerationJobs.generated_images })
              .from(sceneImageGenerationJobs)
              .where(eq(sceneImageGenerationJobs.id, savedImage.generation_job_id))
              .limit(1);
            if (job?.generated_images) {
              shotKeys = job.generated_images as string[];
            }
          }

          sceneData.arollShots = scene.arollShots.map((shot, index) => ({
            dialogue: shot.dialogue,
            action: shot.action,
            emotion: shot.emotion,
            characterIndex: shot.characterIndex,
            voiceId: effectiveVoiceConfig?.[shot.characterIndex]?.voiceId || voiceId || undefined,
            imageKey: shotKeys?.[index] || savedImage.image_key,
            ambientSound: shot.ambientSound,
            cinematicPrompt: shot.cinematicPrompt,
          }));

          if (!isSilent) {
            const missingVoice = sceneData.arollShots.find((s) => !s.voiceId);
            if (missingVoice) {
              return res.status(400).json({
                error: `Scene ${scene.sceneNumber}: character ${missingVoice.characterIndex} has no voice assigned. Please assign voices to all characters.`,
              });
            }
          }

          console.log(
            `[UGC_VIDEO] Scene ${scene.sceneNumber}: Built ${sceneData.arollShots!.length}-shot podcast a-roll-multi`
          );
        }

        scenes.push(sceneData);
      }

      await teamService.incrementTeamUsage(teamId, creditCost);

      const [job] = await db
        .insert(ugcVideoGenerationJobs)
        .values({
          team_id: teamId,
          user_id: req.user.dbUserId,
          script_id: scriptId,
          voice_id: voiceId || "",
          voice_config: effectiveVoiceConfig || undefined,
          status: "queued" as const,
          progress: 0,
          progress_message: "Queued for video generation...",
        })
        .returning();

      // Send to SQS
      await sqsService.sendGenerateUGCVideoJob({
        jobId: job.id,
        teamId,
        userId: req.user.dbUserId,
        scriptId,
        voiceId: voiceId || "",
        voiceConfig: effectiveVoiceConfig || undefined,
        scenes,
        isSilent,
      });

      return res.status(202).json({
        success: true,
        jobId: job.id,
        status: "queued",
        message: "Video generation started. Poll for status.",
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_VIDEO] Generate video error", error, "Failed to queue video generation");
    }
  }

  /**
   * Get video generation job status
   */
  async getVideoGenerationStatus(req: AuthRequest, res: Response<any | ErrorResponse>) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const [job] = await db
        .select()
        .from(ugcVideoGenerationJobs)
        .where(eq(ugcVideoGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const response: any = {
        jobId: job.id,
        scriptId: job.script_id,
        status: job.status,
        progress: job.progress,
        progressMessage: job.progress_message,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
      };

      if (job.status === "completed" && job.final_video_key) {
        response.finalVideoUrl = await s3Service.getPresignedUrl(
          job.final_video_key,
          3600
        );
        response.finalVideoKey = job.final_video_key;
        response.totalDurationSeconds = job.total_duration_seconds;
        response.sceneVideos = job.scene_videos;

        const [clipForJob] = await db
          .select({ id: clips.id })
          .from(clips)
          .where(sql`${clips.clip_metadata}->>'generationJobId' = ${jobId}`)
          .limit(1);

        response.clipId = clipForJob?.id || null;
      }

      if (job.status === "failed") {
        response.error = job.error_message;
      }

      return res.status(200).json(response);
    } catch (error) {
      return handleControllerError(res, "[UGC_VIDEO] Get status error", error, "Failed to get job status");
    }
  }

  /**
   * Get the generated video for a script (if any)
   */
  async getScriptVideo(req: AuthRequest, res: Response<{ jobId: string; videoKey: string; videoUrl: string; totalDurationSeconds: any; sceneVideos: any; createdAt: any; completedAt: any } | ErrorResponse>) {
    try {
      const { scriptId } = req.params;

      if (!scriptId) {
        return res.status(400).json({ error: "scriptId is required" });
      }

      // Find the latest completed video generation job for this script
      const [job] = await db
        .select()
        .from(ugcVideoGenerationJobs)
        .where(
          and(
            eq(ugcVideoGenerationJobs.script_id, scriptId),
            eq(ugcVideoGenerationJobs.status, "completed")
          )
        )
        .orderBy(desc(ugcVideoGenerationJobs.completed_at))
        .limit(1);

      if (!job || !job.final_video_key) {
        return res.status(404).json({
          error: "No completed video found for this script",
        });
      }

      const videoUrl = await s3Service.getPresignedUrl(job.final_video_key, 3600);

      return res.status(200).json({
        jobId: job.id,
        videoKey: job.final_video_key,
        videoUrl,
        totalDurationSeconds: job.total_duration_seconds,
        sceneVideos: job.scene_videos,
        createdAt: job.created_at,
        completedAt: job.completed_at,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_VIDEO] Get script video error", error, "Failed to get video");
    }
  }

  /**
   * Finalize a completed video and create a clip in the library
   */
  async finalizeVideo(req: AuthRequest, res: Response<{ success: boolean; clipId: number; clipPath: string | null } | ErrorResponse>) {
    try {
      const { jobId, teamId, folderId } = req.body;

      if (!jobId || !teamId) {
        return res.status(400).json({
          error: "jobId and teamId are required",
        });
      }

      if (!req.user?.dbUserId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get the completed video job
      const [job] = await db
        .select()
        .from(ugcVideoGenerationJobs)
        .where(eq(ugcVideoGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Video job not found" });
      }

      if (job.status !== "completed" || !job.final_video_key) {
        return res.status(400).json({
          error: "Video generation must be completed before finalizing",
        });
      }

      // Check if already finalized — return existing clip instead of creating a duplicate
      const [existingClip] = await db
        .select({ id: clips.id })
        .from(clips)
        .where(sql`${clips.clip_metadata}->>'generationJobId' = ${jobId}`)
        .limit(1);

      if (existingClip) {
        return res.status(200).json({
          success: true,
          clipId: existingClip.id,
          clipPath: job.final_video_key,
        });
      }

      // Get the script to extract title and scene data for captions
      const [script] = await db
        .select()
        .from(ugcScripts)
        .where(eq(ugcScripts.id, job.script_id));

      const scriptsData = script?.scripts_data as any[];
      const selectedScript = scriptsData?.[script?.selected_variant_index ?? 0];
      const title = selectedScript?.title || "UGC Video";

      // Generate captions using Deepgram transcription of the actual audio
      const sceneVideos = job.scene_videos as Array<{
        sceneId: string;
        sceneNumber: number;
        audioKey: string;
        videoKey: string;
      }> | null;

      let captionsData: CaptionEntry[] = [];

      // Download video and transcribe with Deepgram for accurate captions
      const tempDir = path.join(process.cwd(), "output", "temp-transcribe");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempVideoPath = path.join(tempDir, `finalize_${jobId}_${Date.now()}.mp4`);

      try {
        console.log("[UGC_VIDEO] Downloading video for transcription...");
        await s3Service.downloadVideoFromUrl(
          await s3Service.getPresignedUrl(job.final_video_key, 300),
          tempVideoPath
        );

        console.log("[UGC_VIDEO] Transcribing video with Deepgram...");
        const transcription = await transcribeVideoService(tempVideoPath);

        // Extract words from Deepgram response
        const words = transcription?.results?.channels?.[0]?.alternatives?.[0]?.words || [];

        if (words.length > 0) {
          console.log(`[UGC_VIDEO] Got ${words.length} words from transcription`);
          captionsData = convertWordsToCaptionEntries(words, 4);
          console.log(`[UGC_VIDEO] Created ${captionsData.length} caption entries`);
        } else {
          console.log("[UGC_VIDEO] No words found in transcription");
        }
      } catch (transcribeError) {
        console.error("[UGC_VIDEO] Transcription failed, proceeding without captions:", transcribeError);
        // Continue without captions rather than failing the finalization
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempVideoPath)) {
          fs.unlinkSync(tempVideoPath);
        }
      }

      // Create the clip record
      const [clip] = await db
        .insert(clips)
        .values({
          team_id: teamId,
          generated_by_user_id: req.user.dbUserId,
          folder_id: folderId || null,
          clip_path: job.final_video_key,
          blank_video_path: job.final_video_key,
          captions_data: captionsData.length > 0 ? captionsData : null,
          clip_metadata: {
            type: "ugc",
            scriptId: job.script_id,
            generationJobId: jobId,
            totalDurationSeconds: job.total_duration_seconds,
            sceneCount: sceneVideos?.length || 0,
          },
          title,
          status: "completed",
          saved: true,
        })
        .returning();

      console.log("[UGC_VIDEO] Finalized video as clip:", clip.id);

      return res.status(200).json({
        success: true,
        clipId: clip.id,
        clipPath: clip.clip_path,
      });
    } catch (error) {
      return handleControllerError(res, "[UGC_VIDEO] Finalize video error", error, "Failed to finalize video");
    }
  }

  /**
   * Delete a video generation job and its S3 assets
   */
  async deleteVideoJob(req: AuthRequest, res: Response<{ success: boolean } | ErrorResponse>) {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        return res.status(400).json({ error: "jobId is required" });
      }

      const [job] = await db
        .select()
        .from(ugcVideoGenerationJobs)
        .where(eq(ugcVideoGenerationJobs.id, jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Delete final video from S3
      if (job.final_video_key) {
        try {
          await s3Service.deleteObject(job.final_video_key);
        } catch (e) {
          console.warn("[UGC_VIDEO] Failed to delete final video:", e);
        }
      }

      // Delete individual scene videos and audio from S3
      const sceneVideos = job.scene_videos as Array<{
        sceneId: string;
        sceneNumber: number;
        audioKey: string;
        videoKey: string;
      }> | null;

      if (sceneVideos?.length) {
        for (const scene of sceneVideos) {
          if (scene.videoKey) {
            try {
              await s3Service.deleteObject(scene.videoKey);
            } catch (e) {
              console.warn("[UGC_VIDEO] Failed to delete scene video:", e);
            }
          }
          if (scene.audioKey) {
            try {
              await s3Service.deleteObject(scene.audioKey);
            } catch (e) {
              console.warn("[UGC_VIDEO] Failed to delete scene audio:", e);
            }
          }
        }
      }

      // Delete the database record
      await db
        .delete(ugcVideoGenerationJobs)
        .where(eq(ugcVideoGenerationJobs.id, jobId));

      console.log(`[UGC_VIDEO] Deleted job ${jobId}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      return handleControllerError(res, "[UGC_VIDEO] Delete job error", error, "Failed to delete video job");
    }
  }
}

export const ugcVideoController = new UGCVideoController();
