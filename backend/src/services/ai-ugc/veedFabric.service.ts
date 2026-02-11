import { fal } from "@fal-ai/client";
import { config } from "../../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

export type VeedResolution = "720p" | "480p";

/**
 * Options for VEED Fabric audio-to-video generation.
 * Matches Kling Avatar interface for easy swapping.
 */
export interface VeedFabricOptions {
  imageUrl: string;
  audioUrl: string;
  resolution?: VeedResolution;
}

export interface VeedFabricResult {
  videoUrl: string;
  requestId: string;
}

// Internal response type matching VEED's API
interface VeedFabricResponse {
  video: {
    url: string;
    content_type?: string;
  };
}

/**
 * Generate a talking head video using VEED Fabric 1.0.
 *
 * Like Kling Avatar, takes an image and audio URL to generate lip-synced video.
 */
export async function generateFabricVideo(
  options: VeedFabricOptions,
): Promise<VeedFabricResult> {
  const { imageUrl, audioUrl, resolution = "720p" } = options;

  console.log(`[VEED Fabric] Generating talking head video`);
  console.log(`[VEED Fabric] Image: ${imageUrl.substring(0, 80)}...`);
  console.log(`[VEED Fabric] Audio: ${audioUrl.substring(0, 80)}...`);
  console.log(`[VEED Fabric] Resolution: ${resolution}`);

  try {
    const result = await fal.subscribe("veed/fabric-1.0", {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) =>
            console.log(`[VEED Fabric] ${log.message}`),
          );
        }
      },
    });

    const data = result.data as VeedFabricResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in generation response");
    }

    console.log(`[VEED Fabric] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[VEED Fabric] Generation failed:", error);
    throw error;
  }
}

/**
 * Generate a talking head video with automatic retries.
 * Mirrors the interface of klingService.generateAvatarWithRetry for A/B testing.
 */
export async function generateFabricVideoWithRetry(
  options: VeedFabricOptions,
  maxRetries: number = 3,
): Promise<VeedFabricResult> {
  let lastError: Error | null = null;
  const currentOptions = { ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateFabricVideo(currentOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message || String(error);
      const isTimeout =
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("timeout");

      console.warn(
        `[VEED Fabric] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message,
        isTimeout ? "(network timeout)" : "",
      );

      if (attempt < maxRetries) {
        const baseDelay = isTimeout ? 10000 : 2000;
        const delay = baseDelay * attempt;
        console.log(`[VEED Fabric] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Video generation failed after retries");
}

export const veedFabricService = {
  generateFabricVideo,
  generateFabricVideoWithRetry,
};
