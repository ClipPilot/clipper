import * as Sentry from "@sentry/node";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { s3Service } from "../s3.service";
import { config } from "../../config/env";
import { cutClip, getVideoDuration } from "../clips/videoEditor.service";
import crypto from "crypto";
import path from "path";

export interface Scene {
  start: number;
  end: number;
  duration: number;
}

export interface ChunkBoundary {
  start: number;
  end: number;
}

export interface SilencePoint {
  start: number;
  end: number;
  duration: number;
  midpoint: number; // Best point to cut (center of silence)
}

interface SceneDetectResponse {
  success: boolean;
  scenes: Scene[];
  silencePoints?: SilencePoint[]; // NEW: Audio pause points
  totalDuration: number;
  sceneCount: number;
  silencePointCount?: number;
  error?: string;
}

const lambdaClient = new LambdaClient({
  region: config.aws.region,
});

const SCENE_DETECT_LAMBDA = `clipster-scene-detect-${process.env.NODE_ENV === "production" ? "prod" : "staging"}`;

interface SceneDetectResult {
  scenes: Scene[];
  silencePoints: SilencePoint[];
}

/**
 * Invoke the scene detection Lambda to get scene boundaries AND silence points.
 */
async function invokeSceneDetectLambda(
  videoPath: string,
  threshold: number = 30,
  minSceneLength: number = 0.5
): Promise<SceneDetectResult> {
  console.log(`[SCENE-CHUNKER] Invoking Lambda for scene detection`);

  const s3Key = `temp-scene-detect/${Date.now()}_${path.basename(videoPath)}`;
  console.log(`[SCENE-CHUNKER] Uploading video to S3: ${s3Key}`);

  await s3Service.uploadFile(videoPath, s3Key, "video/mp4");

  try {
    const payload = {
      bucket: config.aws.s3Bucket,
      key: s3Key,
      threshold,
      minSceneLength,
    };

    const command = new InvokeCommand({
      FunctionName: SCENE_DETECT_LAMBDA,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await lambdaClient.send(command);

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? JSON.parse(Buffer.from(response.Payload).toString())
        : { error: "Unknown Lambda error" };
      throw new Error(`Lambda error: ${errorPayload.errorMessage || errorPayload.error}`);
    }

    const result = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    if (!result) {
      throw new Error("Empty response from scene detect Lambda");
    }

    const body: SceneDetectResponse = typeof result.body === "string"
      ? JSON.parse(result.body)
      : result.body || result;

    if (!body.success) {
      throw new Error(body.error || "Scene detection failed");
    }

    console.log(`[SCENE-CHUNKER] Lambda returned ${body.scenes?.length || 0} scenes, ${body.silencePoints?.length || 0} silence points`);
    return {
      scenes: body.scenes || [],
      silencePoints: body.silencePoints || [],
    };
  } finally {
    // Cleanup temp S3 file
    try {
      await s3Service.deleteObject(s3Key);
      console.log(`[SCENE-CHUNKER] Cleaned up temp S3 file: ${s3Key}`);
    } catch (cleanupErr) {
      console.warn(`[SCENE-CHUNKER] Failed to cleanup temp file: ${cleanupErr}`);
      Sentry.captureException(cleanupErr);
    }
  }
}

/**
 * Find the best silence point to use as a cut within a time range.
 * Prefers silence points closest to the target time.
 */
function findBestSilencePoint(
  silencePoints: SilencePoint[],
  targetTime: number,
  minTime: number,
  maxTime: number,
  searchRadius: number = 2.0 // Look within ±2 seconds of target
): number | null {
  const searchMin = Math.max(minTime, targetTime - searchRadius);
  const searchMax = Math.min(maxTime, targetTime + searchRadius);

  // Find silence points within the search window
  const validPoints = silencePoints.filter(
    sp => sp.midpoint >= searchMin && sp.midpoint <= searchMax
  );

  if (validPoints.length === 0) {
    return null;
  }

  // Return the midpoint closest to our target time
  validPoints.sort((a, b) =>
    Math.abs(a.midpoint - targetTime) - Math.abs(b.midpoint - targetTime)
  );

  console.log(`[SCENE-CHUNKER] Found silence point at ${validPoints[0].midpoint.toFixed(2)}s (target was ${targetTime.toFixed(2)}s)`);
  return validPoints[0].midpoint;
}

/**
 * Greedy algorithm to combine consecutive scenes into chunks of approximately targetDuration.
 * If a single scene exceeds targetDuration + leeway, it will be sub-chunked at silence points
 * to avoid cutting in the middle of words.
 */
export function combineScenesToChunks(
  scenes: Scene[],
  targetDuration: number,
  leeway: number,
  silencePoints: SilencePoint[] = []
): ChunkBoundary[] {
  if (scenes.length === 0) {
    return [];
  }

  const maxChunkDuration = targetDuration + leeway;
  const chunks: ChunkBoundary[] = [];

  let currentChunk: ChunkBoundary | null = null;
  let currentDuration = 0;

  for (const scene of scenes) {
    // If scene itself is too long, we need to handle it specially
    if (scene.duration > maxChunkDuration) {
      // First, finalize any current chunk
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = null;
        currentDuration = 0;
      }

      // Sub-chunk this long scene, preferring silence points over fixed intervals
      let start = scene.start;
      while (start < scene.end) {
        const remaining = scene.end - start;

        if (remaining <= maxChunkDuration) {
          // Last piece fits in one chunk
          chunks.push({ start, end: scene.end });
          break;
        }

        // Target cut point is at targetDuration, but look for nearby silence
        const targetCut = start + targetDuration;

        // Try to find a silence point near our target cut
        const silenceCut = findBestSilencePoint(
          silencePoints,
          targetCut,
          start + 5, // Ensure chunk is at least 5 seconds
          start + maxChunkDuration, // Don't exceed max
          3.0 // Search ±3 seconds around target
        );

        const end = silenceCut ?? targetCut; // Fall back to target if no silence found

        chunks.push({ start, end });
        start = end;
      }
      continue;
    }

    // Check if adding this scene would exceed the max chunk duration
    if (currentChunk && currentDuration + scene.duration > maxChunkDuration) {
      // Finalize current chunk
      chunks.push(currentChunk);
      currentChunk = null;
      currentDuration = 0;
    }

    // Start new chunk or extend current one
    if (!currentChunk) {
      currentChunk = { start: scene.start, end: scene.end };
      currentDuration = scene.duration;
    } else {
      currentChunk.end = scene.end;
      currentDuration += scene.duration;
    }
  }

  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Fallback: blind chunking at fixed intervals (original behavior).
 */
async function blindChunkVideo(
  videoPath: string,
  tempDir: string,
  targetDuration: number,
  leeway: number
): Promise<string[]> {
  const duration = await getVideoDuration(videoPath);
  const maxChunkDuration = targetDuration + leeway;
  const chunkPaths: string[] = [];

  if (duration <= maxChunkDuration) {
    // No chunking needed
    return [videoPath];
  }

  let start = 0;
  let chunkIdx = 0;

  while (start < duration) {
    const remaining = duration - start;
    const end = remaining <= maxChunkDuration ? duration : start + targetDuration;
    const chunkPath = path.join(tempDir, `${crypto.randomUUID()}_blind_chunk${chunkIdx}.mp4`);
    await cutClip(videoPath, chunkPath, start, end);
    chunkPaths.push(chunkPath);
    start = end;
    chunkIdx++;
  }

  return chunkPaths;
}

export interface SceneChunkOptions {
  targetDuration?: number;
  leeway?: number;
  threshold?: number;
  minSceneLength?: number;
}

/**
 * Main entry point: detect scenes, combine to ~targetDuration chunks, and cut video.
 * Falls back to blind chunking if scene detection fails.
 */
export async function createSceneAwareChunks(
  videoPath: string,
  tempDir: string,
  options: SceneChunkOptions = {}
): Promise<string[]> {
  const {
    targetDuration = 10,
    leeway = 1,
    threshold = 30,
    minSceneLength = 0.5,
  } = options;

  const maxChunkDuration = targetDuration + leeway;

  try {
    // Step 1: Get video duration
    const videoDuration = await getVideoDuration(videoPath);
    console.log(`[SCENE-CHUNKER] Video duration: ${videoDuration.toFixed(2)}s`);

    // If video is short enough, no chunking needed
    if (videoDuration <= maxChunkDuration) {
      console.log(`[SCENE-CHUNKER] Video fits in single chunk, no splitting needed`);
      return [videoPath];
    }

    // Step 2: Detect scenes AND silence points via Lambda
    const { scenes, silencePoints } = await invokeSceneDetectLambda(videoPath, threshold, minSceneLength);
    console.log(`[SCENE-CHUNKER] Received ${silencePoints.length} silence points for smart sub-chunking`);

    // If no scenes detected (e.g., single continuous shot), fall back to blind chunking
    if (scenes.length === 0) {
      console.log(`[SCENE-CHUNKER] No scenes detected, falling back to blind chunking`);
      return blindChunkVideo(videoPath, tempDir, targetDuration, leeway);
    }

    // Step 3: Combine scenes into chunks (using silence points for sub-chunking long scenes)
    const chunkBoundaries = combineScenesToChunks(scenes, targetDuration, leeway, silencePoints);
    console.log(`[SCENE-CHUNKER] Combined ${scenes.length} scenes into ${chunkBoundaries.length} chunks`);

    // Log chunk details
    chunkBoundaries.forEach((chunk, i) => {
      const duration = chunk.end - chunk.start;
      console.log(`[SCENE-CHUNKER] Chunk ${i + 1}: ${chunk.start.toFixed(2)}s - ${chunk.end.toFixed(2)}s (${duration.toFixed(2)}s)`);
    });

    // Step 4: Cut video at chunk boundaries
    const chunkPaths: string[] = [];

    for (let i = 0; i < chunkBoundaries.length; i++) {
      const boundary = chunkBoundaries[i];
      const chunkPath = path.join(tempDir, `${crypto.randomUUID()}_scene_chunk${i}.mp4`);
      await cutClip(videoPath, chunkPath, boundary.start, boundary.end);
      chunkPaths.push(chunkPath);
    }

    console.log(`[SCENE-CHUNKER] Created ${chunkPaths.length} scene-aware chunks`);
    return chunkPaths;

  } catch (error) {
    console.warn(`[SCENE-CHUNKER] Scene detection failed, falling back to blind chunking:`, error);
    Sentry.captureException(error);

    // Fallback to original blind chunking
    return blindChunkVideo(videoPath, tempDir, targetDuration, leeway);
  }
}
