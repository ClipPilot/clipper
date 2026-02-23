import { fal } from "./falClient";

const FACE_SWAP_TIMEOUT_MS = 600000; // 10 minutes - video processing takes longer

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export interface FaceSwapVideoOptions {
  sourceFaceUrl: string;
  targetVideoUrl: string;
  enableOcclusionPrevention?: boolean;
}

export interface FaceSwapVideoResult {
  videoUrl: string;
  requestId: string;
  processingTimeMs?: number;
  warning?: string;
}

interface FalFaceSwapResponse {
  video: {
    url: string;
    content_type?: string;
  };
  processing_time_ms?: number;
  warning?: string;
}

export async function faceSwapVideo(
  options: FaceSwapVideoOptions
): Promise<FaceSwapVideoResult> {
  const {
    sourceFaceUrl,
    targetVideoUrl,
    enableOcclusionPrevention = false,
  } = options;

  console.log(`[FaceSwap] Starting face swap (occlusion=${enableOcclusionPrevention})`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await withTimeout(
      (fal.subscribe as any)("half-moon-ai/ai-face-swap/faceswapvideo", {
        input: {
          source_face_url: sourceFaceUrl,
          target_video_url: targetVideoUrl,
          enable_occlusion_prevention: enableOcclusionPrevention,
        },
        logs: true,
        onQueueUpdate: (update: { status: string; logs?: Array<{ message: string }> }) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.forEach((log) => console.log(`[FaceSwap] ${log.message}`));
          }
        },
      }),
      FACE_SWAP_TIMEOUT_MS,
      "FAL face swap"
    )) as { data: FalFaceSwapResponse; requestId: string };

    const data = result.data;

    if (!data?.video?.url) {
      throw new Error("No video URL in face swap response");
    }

    console.log(`[FaceSwap] Complete: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
      processingTimeMs: data.processing_time_ms,
      warning: data.warning,
    };
  } catch (error) {
    console.error("[FaceSwap] Failed:", error);
    throw error;
  }
}

/**
 * Face swap video with retry logic
 */
export async function faceSwapVideoWithRetry(
  options: FaceSwapVideoOptions,
  maxRetries: number = 3
): Promise<FaceSwapVideoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await faceSwapVideo(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[FaceSwap] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[FaceSwap] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Face swap failed after retries");
}

export const faceSwapService = {
  faceSwapVideo,
  faceSwapVideoWithRetry,
};
