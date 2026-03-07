import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import { GenerateUGCVideoJob } from "../../services/sqs.service";
import {
  assembleUGCVideo,
  SceneVideoData,
} from "../../services/ai-ugc/ugcVideoAssembly.service";
import { notifyUGCVideoJobUpdate, notifyAdCloneJobUpdate } from "../notify";
import { sanitizeErrorForFrontend } from "../../utils/errorSanitizer";
import { s3Service } from "../../services/s3.service";
import { transcribeVideoService } from "../../services/clips/transcription.service";
import { convertWordsToCaptionEntries, CaptionEntry } from "../../services/clips/captions.service";
import { adCloneService } from "../../services/ad-clone/adclone.service";

/**
 * Update job progress in database and emit real-time update
 */
async function updateJobProgress(
  jobId: string,
  teamId: number,
  progress: number,
  message: string,
  totalScenes: number,
  currentScene?: number
): Promise<void> {
  await db
    .update(schema.ugcVideoGenerationJobs)
    .set({
      progress,
      progress_message: message,
    })
    .where(eq(schema.ugcVideoGenerationJobs.id, jobId));

  // Emit real-time update via Socket.io
  await notifyUGCVideoJobUpdate(teamId, {
    jobId,
    status: "generating",
    progress,
    progressMessage: message,
    currentScene,
    totalScenes,
  });
}

/**
 * Best-effort: create a clip record in the library once the video is done.
 * Returns the new clipId on success, or null if anything goes wrong.
 */
async function createClipFromCompletedJob(
  jobId: string,
  teamId: number,
  userId: number,
  scriptId: string,
  isSilent: boolean,
  finalVideoKey: string,
  totalDuration: number | null,
  sceneCount: number
): Promise<number | null> {
  try {
    // --- Transcribe for captions (best-effort, skip for silent videos) ---
    let captionsData: CaptionEntry[] = [];

    if (!isSilent) {
      const tempDir = path.join(process.cwd(), "output", "temp-transcribe");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempVideoPath = path.join(tempDir, `worker_${jobId}_${Date.now()}.mp4`);

      try {
        console.log(`[UGC_VIDEO] Downloading video for transcription...`);
        await s3Service.downloadToFile(finalVideoKey, tempVideoPath);

        console.log(`[UGC_VIDEO] Transcribing video with Deepgram...`);
        const transcription = await transcribeVideoService(tempVideoPath);
        const words =
          transcription?.results?.channels?.[0]?.alternatives?.[0]?.words || [];

        if (words.length > 0) {
          console.log(`[UGC_VIDEO] Got ${words.length} words from transcription`);
          captionsData = convertWordsToCaptionEntries(words, 4);
        }
      } catch (transcribeError) {
        console.error(
          "[UGC_VIDEO] Transcription failed, proceeding without captions:",
          transcribeError
        );
      } finally {
        if (fs.existsSync(tempVideoPath)) {
          fs.unlinkSync(tempVideoPath);
        }
      }
    } else {
      console.log(`[UGC_VIDEO] Silent video — skipping transcription and captions`);
    }

    // --- Determine clip type: check if job belongs to an Ad Clone project ---
    const [adCloneProject] = await db
      .select({
        id: schema.adCloneProjects.id,
        reference_video_key: schema.adCloneProjects.reference_video_key,
        product_name: schema.adCloneProjects.product_name,
        selected_variant_index: schema.adCloneProjects.selected_variant_index,
      })
      .from(schema.adCloneProjects)
      .where(eq(schema.adCloneProjects.video_job_id, jobId))
      .limit(1);

    // Get script title
    const [script] = await db
      .select({
        scripts_data: schema.ugcScripts.scripts_data,
        selected_variant_index: schema.ugcScripts.selected_variant_index,
        product_name: schema.ugcScripts.product_name,
      })
      .from(schema.ugcScripts)
      .where(eq(schema.ugcScripts.id, scriptId));

    const scriptsData = script?.scripts_data as any[] | undefined;
    const selectedScript = scriptsData?.[script?.selected_variant_index ?? 0];
    const title = selectedScript?.title || script?.product_name || "UGC Video";

    let clipMetadata: Record<string, any>;

    if (adCloneProject) {
      // Transition the ad clone project to completed
      await adCloneService.setFinalVideo(adCloneProject.id, finalVideoKey);

      clipMetadata = {
        type: "ad-clone",
        projectId: adCloneProject.id,
        scriptId,
        generationJobId: jobId,
        referenceVideoKey: adCloneProject.reference_video_key,
        productName: adCloneProject.product_name,
        scenes: sceneCount,
      };
    } else {
      clipMetadata = {
        type: "ugc",
        scriptId,
        generationJobId: jobId,
        totalDurationSeconds: totalDuration,
        sceneCount,
      };
    }

    // --- Insert clip ---
    const [clip] = await db
      .insert(schema.clips)
      .values({
        team_id: teamId,
        generated_by_user_id: userId,
        clip_path: finalVideoKey,
        blank_video_path: finalVideoKey,
        captions_data: captionsData.length > 0 ? captionsData : null,
        clip_metadata: clipMetadata,
        title,
        status: "completed",
        saved: true,
      })
      .returning({ id: schema.clips.id });

    console.log(
      `[UGC_VIDEO] Worker created clip ${clip.id} for job ${jobId}` +
        (adCloneProject ? ` (ad-clone project ${adCloneProject.id})` : "")
    );

    // If ad-clone, also send an ad-clone socket notification with clipId
    if (adCloneProject) {
      await notifyAdCloneJobUpdate(teamId, {
        projectId: adCloneProject.id,
        status: "completed",
        progress: 100,
        progressMessage: "Video generation complete!",
        clipId: clip.id,
      });
    }

    return clip.id;
  } catch (error) {
    console.error(`[UGC_VIDEO] Failed to create clip for job ${jobId}:`, error);
    return null;
  }
}

/**
 * Main processor for UGC video generation jobs
 * Orchestrates: TTS → image-to-video → lipsync/overlay → concatenation
 */
export async function processUGCVideoJob(
  job: GenerateUGCVideoJob
): Promise<void> {
  const { jobId, teamId, userId, scriptId, voiceId, scenes, ttsSpeed, isSilent } = job;

  console.log(
    `[UGC_VIDEO] Starting video generation for job ${jobId} (script ${scriptId})`
  );
  console.log(`[UGC_VIDEO] Processing ${scenes.length} scenes`);

  const totalScenes = scenes.length;

  try {
    // Update status to "generating" and emit initial status
    await db
      .update(schema.ugcVideoGenerationJobs)
      .set({
        status: "generating",
        started_at: new Date(),
        progress: 0,
        progress_message: "Starting video generation...",
      })
      .where(eq(schema.ugcVideoGenerationJobs.id, jobId));

    // Emit initial status
    await notifyUGCVideoJobUpdate(teamId, {
      jobId,
      status: "generating",
      progress: 0,
      progressMessage: "Starting video generation...",
      totalScenes,
      currentScene: 0,
    });

    // Convert job scenes to SceneVideoData format
    const sceneVideoData: SceneVideoData[] = scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      shotType: scene.shotType,
      imageKey: scene.imageKey,
      dialogue: scene.dialogue,
      duration: scene.duration,
      cinematicPrompt: scene.cinematicPrompt,
      action: scene.action,
      emotion: scene.emotion,
      ambientSound: scene.ambientSound,
      bRollShots: scene.bRollShots, // Pass through B-roll shots for montage processing
    }));

    // Track current scene for real-time updates
    let currentSceneNumber = 0;

    // Run the full assembly pipeline
    const result = await assembleUGCVideo({
      teamId,
      scriptId,
      voiceId,
      scenes: sceneVideoData,
      ttsSpeed,
      isSilent,
      onProgress: (progress, message) => {
        // Parse scene number from message if possible
        const sceneMatch = message.match(/scene (\d+)/i);
        if (sceneMatch) {
          currentSceneNumber = parseInt(sceneMatch[1], 10);
        }

        // Update progress in database and emit (fire and forget)
        updateJobProgress(jobId, teamId, progress, message, totalScenes, currentSceneNumber).catch((err) =>
          console.error(`[UGC_VIDEO] Failed to update progress:`, err)
        );
      },
    });

    // Build scene videos array
    const sceneVideosData = result.sceneVideos.map((s) => ({
      sceneId: s.sceneId,
      sceneNumber: s.sceneNumber,
      audioKey: s.audioKey,
      videoKey: s.videoKey,
    }));

    // Update job as completed with results
    await db
      .update(schema.ugcVideoGenerationJobs)
      .set({
        status: "completed",
        progress: 100,
        progress_message: "Video generation complete!",
        scene_videos: sceneVideosData,
        final_video_key: result.finalVideoKey,
        total_duration_seconds: result.totalDuration,
        completed_at: new Date(),
      })
      .where(eq(schema.ugcVideoGenerationJobs.id, jobId));

    // Best-effort: create clip record so it appears in the library
    // even if the user navigates away from the generation page
    const clipId = await createClipFromCompletedJob(
      jobId,
      teamId,
      userId,
      scriptId,
      !!isSilent,
      result.finalVideoKey,
      result.totalDuration,
      sceneVideosData.length
    );

    // Emit completion status with final video info (includes clipId if created)
    await notifyUGCVideoJobUpdate(teamId, {
      jobId,
      status: "completed",
      progress: 100,
      progressMessage: "Video generation complete!",
      totalScenes,
      currentScene: totalScenes,
      finalVideoKey: result.finalVideoKey,
      totalDurationSeconds: result.totalDuration,
      sceneVideos: sceneVideosData,
      clipId,
    });

    console.log(
      `[UGC_VIDEO] Job ${jobId} completed successfully. Final video: ${result.finalVideoKey}` +
        (clipId ? `, clip: ${clipId}` : "")
    );
  } catch (error) {
    console.error(`[UGC_VIDEO] Job ${jobId} failed:`, error);

    const errorMessage = sanitizeErrorForFrontend(error, "Video generation failed. Please try again.");

    await db
      .update(schema.ugcVideoGenerationJobs)
      .set({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date(),
      })
      .where(eq(schema.ugcVideoGenerationJobs.id, jobId));

    await notifyUGCVideoJobUpdate(teamId, {
      jobId,
      status: "failed",
      progress: 0,
      progressMessage: "Video generation failed",
      totalScenes,
      error: errorMessage,
    });
  }
}
