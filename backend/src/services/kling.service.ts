import { fal } from "@fal-ai/client";
import { config } from "../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

export type ShotType = "a-roll" | "b-roll" | "mixed";
export type KlingDuration = 5 | 10;

export const PRODUCT_NEGATIVE_PROMPT =
  "distortion, warping, morphing, blur, text change, label deformation, " +
  "stretching, proportion change, shape shifting, logo distortion, " +
  "text overlay, subtitles, captions, floating text, graphic overlays, " +
  "watermark, low quality, blurry, out of focus, " +
  "phone screen on back, screen through phone, transparent phone, glitchy phone display";

export const PRODUCT_STABILITY_MODIFIERS =
  "Preserve product shape. Maintain label text. Keep proportions identical. " +
  "Stable camera movement. No distortion. No subtitles or text overlays. " +
  "Phones have opaque solid backs with no screen bleed-through.";

export const GENTLE_MOTION_MODIFIERS =
  "Subtle movement. Slow and controlled. Micro-motion only. " +
  "Maintain silhouette. Keep scale consistent.";

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
  cfgScale?: number; // 0-1, default 0.5. Lower = more natural motion
}

export interface LipsyncResult {
  videoUrl: string;
  requestId: string;
}

// Kling Avatar v2 - optimized for talking heads (single step: image + audio → video)
export interface AvatarOptions {
  imageUrl: string;
  audioUrl: string;
  prompt?: string; // Optional text guidance
}

export interface AvatarResult {
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
    return `${cinematicPrompt}. The person speaks naturally to camera with ${emotion} expression. Subtle, realistic lip movements - not exaggerated. Natural micro-expressions, gentle head movements, relaxed eye contact. Authentic UGC-style, conversational and relaxed. ${GENTLE_MOTION_MODIFIERS}`;
  }

  if (shotType === "b-roll") {
    return `${cinematicPrompt}. Smooth product showcase with subtle, slow camera movement. Professional product photography style with gentle rotation or reveal. Clean background, focused lighting on product. ${PRODUCT_STABILITY_MODIFIERS} ${GENTLE_MOTION_MODIFIERS}`;
  }

  return `${cinematicPrompt}. Person performs action: ${action}. Natural body movement, ${emotion} expression, hands interacting with product. No talking, action-focused. ${PRODUCT_STABILITY_MODIFIERS}`;
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
        negative_prompt: negativePrompt || PRODUCT_NEGATIVE_PROMPT,
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
  maxRetries: number = 3
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
  maxRetries: number = 3
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

interface KlingAvatarResponse {
  video: {
    url: string;
    file_size?: number;
    file_name?: string;
    content_type?: string;
  };
}

// Kling Avatar v2 Pro - optimized single-step talking head generation
// Uses image + audio to generate video with built-in lip sync (better quality than 2-step process)
export async function generateAvatar(
  options: AvatarOptions
): Promise<AvatarResult> {
  const { imageUrl, audioUrl, prompt } = options;

  console.log(`[Kling Avatar v2] Generating talking head video`);
  console.log(`[Kling Avatar v2] Image: ${imageUrl.substring(0, 80)}...`);
  console.log(`[Kling Avatar v2] Audio: ${audioUrl.substring(0, 80)}...`);

  try {
    const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        ...(prompt && { prompt }),
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) => console.log(`[Kling Avatar v2] ${log.message}`));
        }
      },
    });

    const data = result.data as KlingAvatarResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in Kling Avatar v2 response");
    }

    console.log(`[Kling Avatar v2] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Kling Avatar v2] Generation failed:", error);
    throw error;
  }
}

export async function generateAvatarWithRetry(
  options: AvatarOptions,
  maxRetries: number = 3
): Promise<AvatarResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateAvatar(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Kling Avatar v2] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Kling Avatar v2] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Avatar generation failed after retries");
}

export const klingService = {
  generateVideo,
  generateVideoWithRetry,
  applyLipsync,
  applyLipsyncWithRetry,
  generateAvatar,
  generateAvatarWithRetry,
  buildKlingPrompt,
  PRODUCT_NEGATIVE_PROMPT,
  PRODUCT_STABILITY_MODIFIERS,
  GENTLE_MOTION_MODIFIERS,
};
