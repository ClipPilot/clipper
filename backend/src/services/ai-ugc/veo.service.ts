import { fal } from "@fal-ai/client";
import { config } from "../../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

// Default negative prompt for photorealistic human movement
export const VEO_DEFAULT_NEGATIVE_PROMPT =
  "floating limbs, unnatural human movements, jerky motion, robotic movement, " +
  "distorted faces, morphing faces, extra fingers, missing fingers, deformed hands, " +
  "blurry, low quality, pixelated, watermark, text overlay, " +
  "unnatural poses, impossible anatomy, uncanny valley, mannequin-like, " +
  "glitching, artifacts, frame skipping, stuttering motion";

export const VEO_PRODUCT_STABILITY_MODIFIERS =
  "Preserve product shape and proportions. Maintain label text legibility. " +
  "Keep product scale consistent throughout. Stable, smooth camera movement. " +
  "No distortion or warping. No subtitles or text overlays. " +
  "Phones have opaque solid backs with no screen bleed-through.";

export const VEO_GENTLE_MOTION_MODIFIERS =
  "Subtle, slow movement. Controlled and smooth. Micro-motion only. " +
  "Maintain silhouette. Consistent scale throughout. Natural physics.";

export type VeoAspectRatio = "16:9" | "9:16" | "auto";
export type VeoDuration = "7s" | "8s";
export type VeoI2VDuration = "4s" | "6s" | "8s";
export type VeoResolution = "720p" | "1080p";

// Reference-to-Video: Generate video from reference images
export interface ReferenceToVideoOptions {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: "16:9" | "9:16";
  duration?: "8s";
  resolution?: VeoResolution;
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
  autoFix?: boolean;
}

export interface ReferenceToVideoResult {
  videoUrl: string;
  requestId: string;
}

// Extend Video: Extend existing video by 7 seconds
export interface ExtendVideoOptions {
  prompt: string;
  videoUrl: string;
  aspectRatio?: VeoAspectRatio;
  duration?: "7s";
  resolution?: "720p";
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
  autoFix?: boolean;
}

export interface ExtendVideoResult {
  videoUrl: string;
  requestId: string;
}

// Image-to-Video (Fast): Generate video from a single image
export interface ImageToVideoOptions {
  imageUrl: string;
  prompt: string;
  duration?: VeoI2VDuration;
  aspectRatio?: VeoAspectRatio;
  resolution?: VeoResolution;
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
  autoFix?: boolean;
}

export interface ImageToVideoResult {
  videoUrl: string;
  requestId: string;
}

interface VeoVideoResponse {
  video: {
    url: string;
    file_size?: number;
    file_name?: string;
    content_type?: string;
  };
}

/**
 * Generate video from reference images using Veo 3.1
 * Good for maintaining consistent subject appearance across videos
 */
export async function referenceToVideo(
  options: ReferenceToVideoOptions
): Promise<ReferenceToVideoResult> {
  const {
    prompt,
    imageUrls,
    aspectRatio = "16:9",
    duration = "8s",
    resolution = "720p",
    generateAudio = true,
    negativePrompt,
    seed,
    autoFix = false,
  } = options;

  console.log(`[Veo 3.1] Reference-to-video with ${imageUrls.length} images`);
  console.log(`[Veo 3.1] Prompt: ${prompt.substring(0, 150)}...`);
  console.log(
    `[Veo 3.1] Settings: ${aspectRatio}, ${duration}, ${resolution}, audio=${generateAudio}`
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal.subscribe as any)(
      "fal-ai/veo3.1/reference-to-video",
      {
        input: {
          prompt,
          image_urls: imageUrls,
          aspect_ratio: aspectRatio,
          duration,
          resolution,
          generate_audio: generateAudio,
          ...(negativePrompt && { negative_prompt: negativePrompt }),
          ...(seed !== undefined && { seed }),
          auto_fix: autoFix,
        },
        logs: true,
        onQueueUpdate: (update: {
          status: string;
          logs?: Array<{ message: string }>;
        }) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.forEach((log) =>
              console.log(`[Veo 3.1] ${log.message}`)
            );
          }
        },
      }
    );

    const data = result.data as VeoVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in Veo 3.1 response");
    }

    console.log(`[Veo 3.1] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Veo 3.1] Reference-to-video failed:", error);
    throw error;
  }
}

/**
 * Extend an existing video by 7 seconds using Veo 3.1
 * The prompt describes how the video should continue
 */
export async function extendVideo(
  options: ExtendVideoOptions
): Promise<ExtendVideoResult> {
  const {
    prompt,
    videoUrl,
    aspectRatio = "auto",
    duration = "7s",
    resolution = "720p",
    generateAudio = true,
    negativePrompt,
    seed,
    autoFix = false,
  } = options;

  console.log(`[Veo 3.1] Extending video by ${duration}`);
  console.log(`[Veo 3.1] Video URL: ${videoUrl.substring(0, 80)}...`);
  console.log(`[Veo 3.1] Prompt: ${prompt.substring(0, 150)}...`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal.subscribe as any)("fal-ai/veo3.1/extend-video", {
      input: {
        prompt,
        video_url: videoUrl,
        aspect_ratio: aspectRatio,
        duration,
        resolution,
        generate_audio: generateAudio,
        ...(negativePrompt && { negative_prompt: negativePrompt }),
        ...(seed !== undefined && { seed }),
        auto_fix: autoFix,
      },
      logs: true,
      onQueueUpdate: (update: {
        status: string;
        logs?: Array<{ message: string }>;
      }) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) =>
            console.log(`[Veo 3.1 Extend] ${log.message}`)
          );
        }
      },
    });

    const data = result.data as VeoVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in Veo 3.1 extend response");
    }

    console.log(`[Veo 3.1] Video extended: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Veo 3.1] Extend video failed:", error);
    throw error;
  }
}

/**
 * Reference-to-video with retry logic
 */
export async function referenceToVideoWithRetry(
  options: ReferenceToVideoOptions,
  maxRetries: number = 3
): Promise<ReferenceToVideoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await referenceToVideo(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Veo 3.1] Reference-to-video attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Veo 3.1] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Reference-to-video failed after retries");
}

/**
 * Extend video with retry logic
 */
export async function extendVideoWithRetry(
  options: ExtendVideoOptions,
  maxRetries: number = 3
): Promise<ExtendVideoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extendVideo(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Veo 3.1] Extend video attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Veo 3.1] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Extend video failed after retries");
}

/**
 * Generate video from a single image using Veo 3.1
 * Good for B-roll and product shots with configurable duration
 */
export async function imageToVideo(
  options: ImageToVideoOptions
): Promise<ImageToVideoResult> {
  const {
    imageUrl,
    prompt,
    duration = "8s",
    aspectRatio = "auto",
    resolution = "720p",
    generateAudio = false,
    negativePrompt,
    seed,
    autoFix = false,
  } = options;

  console.log(`[Veo 3.1] Image-to-video: ${duration} at ${resolution}`);
  console.log(`[Veo 3.1] Prompt: ${prompt.substring(0, 150)}...`);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fal.subscribe as any)(
      "fal-ai/veo3.1/image-to-video",
      {
        input: {
          prompt,
          image_url: imageUrl,
          aspect_ratio: aspectRatio,
          duration,
          resolution,
          generate_audio: generateAudio,
          ...(negativePrompt && { negative_prompt: negativePrompt }),
          ...(seed !== undefined && { seed }),
          auto_fix: autoFix,
        },
        logs: true,
        onQueueUpdate: (update: {
          status: string;
          logs?: Array<{ message: string }>;
        }) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.forEach((log) =>
              console.log(`[Veo 3.1] ${log.message}`)
            );
          }
        },
      }
    );

    const data = result.data as VeoVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in Veo 3.1 response");
    }

    console.log(`[Veo 3.1] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Veo 3.1] Image-to-video failed:", error);
    throw error;
  }
}

/**
 * Image-to-video with retry logic
 */
export async function imageToVideoWithRetry(
  options: ImageToVideoOptions,
  maxRetries: number = 3
): Promise<ImageToVideoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await imageToVideo(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Veo 3.1] Image-to-video attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Veo 3.1] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Image-to-video failed after retries");
}

// Constants for Veo video durations
const VEO_INITIAL_DURATION = 8; // seconds
const VEO_EXTEND_DURATION = 7; // seconds per extension

/**
 * Generate video for a target duration using Veo 3.1
 *
 * For durations <= 8s: Single reference-to-video call
 * For durations > 8s: Chain extend-video calls (8s + 7s + 7s + ...)
 *
 * The video will be at least targetDuration long (caller should trim to exact length)
 */
export interface GenerateVideoForDurationOptions {
  prompt: string;
  imageUrl: string;
  targetDuration: number;
  aspectRatio?: "16:9" | "9:16";
  resolution?: VeoResolution;
  negativePrompt?: string;
}

export interface GenerateVideoForDurationResult {
  videoUrl: string;
  generatedDuration: number; // Actual duration generated (may be longer than target)
  extensionsUsed: number;
}

export async function generateVideoForDuration(
  options: GenerateVideoForDurationOptions
): Promise<GenerateVideoForDurationResult> {
  const {
    prompt,
    imageUrl,
    targetDuration,
    aspectRatio = "9:16",
    resolution = "720p",
    negativePrompt = VEO_DEFAULT_NEGATIVE_PROMPT,
  } = options;

  console.log(
    `[Veo 3.1] Generating video for ${targetDuration.toFixed(2)}s target duration`
  );

  // Step 1: Generate initial 8s video
  const initialResult = await referenceToVideoWithRetry({
    prompt,
    imageUrls: [imageUrl],
    aspectRatio,
    resolution,
    generateAudio: false, // We'll add our own audio
    negativePrompt,
  });

  let currentVideoUrl = initialResult.videoUrl;
  let currentDuration = VEO_INITIAL_DURATION;
  let extensionsUsed = 0;

  // Step 2: Chain extend-video calls if needed
  while (currentDuration < targetDuration) {
    extensionsUsed++;
    console.log(
      `[Veo 3.1] Extension ${extensionsUsed}: ${currentDuration}s -> ${currentDuration + VEO_EXTEND_DURATION}s`
    );

    const extendResult = await extendVideoWithRetry({
      prompt: "Continue the scene naturally, maintaining the same style and motion.",
      videoUrl: currentVideoUrl,
      aspectRatio: "auto",
      generateAudio: false,
      // Note: Don't pass negativePrompt for extensions - style is already set
    });

    currentVideoUrl = extendResult.videoUrl;
    currentDuration += VEO_EXTEND_DURATION;
  }

  console.log(
    `[Veo 3.1] Final video: ${currentDuration}s (${extensionsUsed} extensions)`
  );

  return {
    videoUrl: currentVideoUrl,
    generatedDuration: currentDuration,
    extensionsUsed,
  };
}

export const veoService = {
  referenceToVideo,
  referenceToVideoWithRetry,
  extendVideo,
  extendVideoWithRetry,
  imageToVideo,
  imageToVideoWithRetry,
  generateVideoForDuration,
};
