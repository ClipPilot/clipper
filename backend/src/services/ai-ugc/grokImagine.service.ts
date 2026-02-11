import { fal } from "@fal-ai/client";
import { config } from "../../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

export type GrokAspectRatio =
  | "auto"
  | "16:9"
  | "4:3"
  | "3:2"
  | "1:1"
  | "2:3"
  | "3:4"
  | "9:16";

export type GrokResolution = "480p" | "720p";

export interface GrokImageToVideoOptions {
  imageUrl: string;
  prompt: string;
  duration?: number; // Default 6 seconds
  aspectRatio?: GrokAspectRatio;
  resolution?: GrokResolution;
}

export interface GrokImageToVideoResult {
  videoUrl: string;
  requestId: string;
}

interface GrokVideoResponse {
  video: {
    url: string;
    height?: number;
    width?: number;
    duration?: number;
    fps?: number;
    file_name?: string;
    content_type?: string;
    num_frames?: number;
  };
}

/**
 * Generate video from image using Grok Imagine (xAI)
 * Optimized for B-roll and product shots
 */
export async function generateVideo(
  options: GrokImageToVideoOptions
): Promise<GrokImageToVideoResult> {
  const {
    imageUrl,
    prompt,
    duration = 6,
    aspectRatio = "auto",
    resolution = "720p",
  } = options;

  console.log(`[Grok Imagine] Generating ${duration}s video from image`);
  console.log(`[Grok Imagine] Prompt: ${prompt.substring(0, 200)}...`);
  console.log(`[Grok Imagine] Aspect ratio: ${aspectRatio}, Resolution: ${resolution}`);

  try {
    const result = await fal.subscribe("xai/grok-imagine-video/image-to-video", {
      input: {
        prompt,
        image_url: imageUrl,
        duration,
        aspect_ratio: aspectRatio,
        resolution,
      },
      logs: true,
      pollInterval: 5000,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) =>
            console.log(`[Grok Imagine] ${log.message}`)
          );
        }
      },
    });

    const data = result.data as GrokVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in generation response");
    }

    console.log(`[Grok Imagine] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Grok Imagine] Video generation failed:", error);
    throw error;
  }
}

/**
 * Generate video with retry logic
 */
export async function generateVideoWithRetry(
  options: GrokImageToVideoOptions,
  maxRetries: number = 3
): Promise<GrokImageToVideoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateVideo(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTimeout =
        lastError.message.includes("ETIMEDOUT") ||
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("timeout");

      console.warn(
        `[Grok Imagine] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message,
        isTimeout ? "(network timeout)" : ""
      );

      if (attempt < maxRetries) {
        const baseDelay = isTimeout ? 10000 : 3000;
        const delay = baseDelay * attempt;
        console.log(`[Grok Imagine] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Grok Imagine video generation failed after retries");
}

export const grokImagineService = {
  generateVideo,
  generateVideoWithRetry,
};
