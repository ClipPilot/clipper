import { fal } from "@fal-ai/client";
import { config } from "../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

export type ShotType = "a-roll" | "b-roll" | "mixed";
export type KlingDuration = 5 | 10;

export interface ImageToVideoOptions {
  imageUrl: string;
  prompt: string;
  duration?: KlingDuration;
  negativePrompt?: string;
  generateAudio?: boolean;
  dialogue?: string;
}

export interface ImageToVideoResult {
  videoUrl: string;
  requestId: string;
}

export interface LipsyncOptions {
  videoUrl: string;
  audioUrl: string;
}

export interface LipsyncResult {
  videoUrl: string;
  requestId: string;
}

interface KlingImageToVideoResponse {
  video: {
    url: string;
    file_size?: number;
    file_name?: string;
    content_type?: string;
  };
}

interface KlingLipsyncResponse {
  video: {
    url: string;
    file_size?: number;
    file_name?: string;
    content_type?: string;
  };
}

export function buildKlingPrompt(
  cinematicPrompt: string,
  shotType: ShotType,
  emotion: string,
  action: string
): string {
  if (shotType === "a-roll") {
    return `${cinematicPrompt}. The person speaks naturally to camera with ${emotion} expression, subtle head movements, natural eye contact, conversational gestures. UGC-style authentic movement, slight handheld feel.`;
  }

  if (shotType === "b-roll") {
    return `${cinematicPrompt}. Smooth product showcase motion, subtle camera movement, professional product photography style with gentle rotation or reveal. Clean background, focused lighting on product.`;
  }

  return `${cinematicPrompt}. Person performs action: ${action}. Natural body movement, ${emotion} expression, hands interacting with product. No talking, action-focused.`;
}

export async function generateVideo(
  options: ImageToVideoOptions
): Promise<ImageToVideoResult> {
  const {
    imageUrl,
    prompt,
    duration = 5,
    negativePrompt,
    generateAudio = false,
    dialogue,
  } = options;

  let finalPrompt = prompt;
  if (generateAudio && dialogue) {
    finalPrompt = `${prompt}. The person speaks naturally and says "${dialogue}"`;
  }

  console.log(`[Kling] Generating ${duration}s video from image (audio: ${generateAudio})`);
  console.log(`[Kling] Prompt: ${finalPrompt.substring(0, 150)}...`);

  try {
    const result = await fal.subscribe("fal-ai/kling-video/v2.6/pro/image-to-video", {
      input: {
        prompt: finalPrompt,
        start_image_url: imageUrl,
        duration: String(duration) as "5" | "10",
        negative_prompt: negativePrompt || "blur, distort, low quality, watermark, text",
        generate_audio: generateAudio,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) => console.log(`[Kling] ${log.message}`));
        }
      },
    });

    const data = result.data as KlingImageToVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in Kling response");
    }

    console.log(`[Kling] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Kling] Video generation failed:", error);
    throw error;
  }
}

export async function applyLipsync(
  options: LipsyncOptions
): Promise<LipsyncResult> {
  const { videoUrl, audioUrl } = options;

  console.log(`[Kling] Applying lipsync to video`);

  try {
    const result = await fal.subscribe("fal-ai/kling-video/lipsync/audio-to-video", {
      input: {
        video_url: videoUrl,
        audio_url: audioUrl,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) => console.log(`[Kling Lipsync] ${log.message}`));
        }
      },
    });

    const data = result.data as KlingLipsyncResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in Kling lipsync response");
    }

    console.log(`[Kling] Lipsync complete: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Kling] Lipsync failed:", error);
    throw error;
  }
}

export async function generateVideoWithRetry(
  options: ImageToVideoOptions,
  maxRetries: number = 1
): Promise<ImageToVideoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateVideo(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Kling] Video generation attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Kling] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Video generation failed after retries");
}

export async function applyLipsyncWithRetry(
  options: LipsyncOptions,
  maxRetries: number = 1
): Promise<LipsyncResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await applyLipsync(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Kling] Lipsync attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Kling] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Lipsync failed after retries");
}

export const klingService = {
  generateVideo,
  generateVideoWithRetry,
  applyLipsync,
  applyLipsyncWithRetry,
  buildKlingPrompt,
};
