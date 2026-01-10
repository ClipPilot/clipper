import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import { GenerateUGCVideoJob } from "../../services/sqs.service";
import {
  assembleUGCVideo,
  SceneVideoData,
} from "../../services/ugcVideoAssembly.service";
import { notifyUGCVideoJobUpdate, UGCVideoJobUpdate } from "../notify";

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
 * Main processor for UGC video generation jobs
 * Orchestrates: TTS → image-to-video → lipsync/overlay → concatenation
 */
export async function processUGCVideoJob(
  job: GenerateUGCVideoJob
): Promise<void> {
  const { jobId, teamId, userId, scriptId, voiceId, scenes } = job;

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
    }));

    // Track current scene for real-time updates
    let currentSceneNumber = 0;

    // Run the full assembly pipeline
    const result = await assembleUGCVideo({
      teamId,
      scriptId,
      voiceId,
      scenes: sceneVideoData,
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

    // Emit completion status with final video info
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
    });

    console.log(
      `[UGC_VIDEO] Job ${jobId} completed successfully. Final video: ${result.finalVideoKey}`
    );
  } catch (error) {
    console.error(`[UGC_VIDEO] Job ${jobId} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

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
