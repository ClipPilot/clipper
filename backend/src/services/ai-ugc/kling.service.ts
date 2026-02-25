import { fal } from "./falClient";
import { openaiClient } from "../openai.service";
import {
  PRODUCT_NEGATIVE_PROMPT,
  PRODUCT_STABILITY_MODIFIERS,
  GENTLE_MOTION_MODIFIERS,
  BROLL_MOTION_MODIFIERS,
  SCREEN_STABILITY_MODIFIERS,
  PRO_MOTION_PROMPT,
  AVATAR_PROMPT,
} from "./klingPrompts";
import {
  generateGroundedCinematicSystemPrompt,
  generateGroundedCinematicUserPrompt,
} from "../../config/groundedPrompts";
import type { ShotType } from "../../types/ugcScript.types";

export {
  PRODUCT_NEGATIVE_PROMPT,
  PRODUCT_STABILITY_MODIFIERS,
  GENTLE_MOTION_MODIFIERS,
  BROLL_MOTION_MODIFIERS,
  SCREEN_STABILITY_MODIFIERS,
  PRO_MOTION_PROMPT,
  AVATAR_PROMPT,
} from "./klingPrompts";

export const KLING_MAX_PROMPT_LENGTH = 2500;

export type { ShotType };
export type KlingV3Duration = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type CharacterOrientation = "image" | "video";

export interface ImageToVideoResult {
  videoUrl: string;
  requestId: string;
}

// Kling v3 Pro types
export interface KlingV3Element {
  frontalImageUrl?: string;
  referenceImageUrls?: string[];
  videoUrl?: string;
}

export interface KlingV3MultiPromptElement {
  prompt: string;
}

export interface ImageToVideoV3Options {
  imageUrl: string;
  endImageUrl?: string;
  prompt: string;
  duration?: KlingV3Duration;
  negativePrompt?: string;
  generateAudio?: boolean;
  dialogue?: string;
  cfgScale?: number; // 0-1, default 0.5
  elements?: KlingV3Element[];
  multiPrompt?: KlingV3MultiPromptElement[];
  voiceIds?: string[];
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

// Kling Avatar v2 - optimized for talking heads (single step: image + audio → video)
export interface AvatarOptions {
  imageUrl: string;
  audioUrl: string;
  prompt?: string; // Optional text guidance
  negativePrompt?: string; // Prevent unwanted elements like subtitles
}

export interface AvatarResult {
  videoUrl: string;
  requestId: string;
}

export interface ExtendVideoOptions {
  videoUrl: string;
  duration?: KlingV3Duration;
}

export interface ExtendVideoResult {
  videoUrl: string;
  requestId: string;
}

export interface MotionControlOptions {
  imageUrl: string;
  videoUrl: string;
  prompt?: string;
  keepOriginalSound?: boolean;
  characterOrientation?: CharacterOrientation;
}

export interface MotionControlResult {
  videoUrl: string;
  requestId: string;
}

// Grounded prompt generation options
export interface GroundedPromptOptions {
  originalCinematicPrompt: string;
  startImageUrl: string;
  endImageUrl?: string;
  shotType: ShotType;
  emotion: string;
  action: string;
}

// Internal response types
interface KlingVideoResponse {
  video: {
    url: string;
    file_size?: number;
    file_name?: string;
    content_type?: string;
  };
}

type KlingImageToVideoResponse = KlingVideoResponse;
type KlingAvatarResponse = KlingVideoResponse;
type KlingExtendVideoResponse = KlingVideoResponse;
type KlingMotionControlResponse = KlingVideoResponse;

/**
 * Rewrites a prompt that caused a 422 error to be more compatible with Kling.
 * Removes potentially problematic content while preserving core intent.
 */
export async function rewritePromptFor422(
  prompt: string,
  errorMessage?: string,
): Promise<string> {
  console.log(`[Kling] Rewriting prompt after 422 error...`);

  const systemPrompt = `You are a video prompt rewriting assistant. A video generation API rejected the following prompt with a 422 error. Rewrite it to be simpler and more compatible.

RULES:
1. Keep the core scene description and action
2. Remove any potentially problematic content (violence, explicit content, copyrighted characters)
3. Simplify complex instructions
4. Remove redundant or conflicting directions
5. Keep it under 2000 characters
6. Make it more generic/safe while preserving the intent

${errorMessage ? `Error hint: ${errorMessage}` : ""}

Return ONLY the rewritten prompt, nothing else.`;

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-5-mini",
      instructions: systemPrompt,
      input: prompt,
    });

    const rewritten = response.output_text?.trim();
    if (rewritten && rewritten.length > 0) {
      console.log(`[Kling] Prompt rewritten (${rewritten.length} chars)`);
      return rewritten;
    }
  } catch (error) {
    console.error(`[Kling] Prompt rewrite failed:`, error);
  }

  // Fallback: just simplify by taking first part
  return prompt.substring(0, 1500);
}

/**
 * Iteratively shortens until under the limit while preserving key instructions.
 * Uses OpenAI responses API (same pattern as aiSuggestions.service.ts)
 */
export async function shortenPromptIfNeeded(
  prompt: string,
  maxLength: number = KLING_MAX_PROMPT_LENGTH,
): Promise<string> {
  if (prompt.length <= maxLength) {
    return prompt;
  }

  console.log(
    `[Kling] Prompt too long (${prompt.length}/${maxLength}), shortening with gpt...`,
  );

  let currentPrompt = prompt;
  let attempts = 0;
  const maxAttempts = 3;

  while (currentPrompt.length > maxLength && attempts < maxAttempts) {
    attempts++;
    const targetLength = Math.floor(maxLength * 0.9); // Aim for 90% of max to have buffer

    const systemPrompt = `You are a prompt shortening assistant. Your job is to shorten video generation prompts while preserving the most critical elements.

CRITICAL RULES TO ALWAYS PRESERVE:
1. Any rules about NOT adding text, captions, or subtitles
2. Any rules about keeping phone/device screens unchanged
3. Any rules about not adding extra elements
4. The core action/scene description
5. Character emotions and expressions

WHAT TO SHORTEN:
- Remove redundant adjectives
- Combine similar instructions
- Remove less critical modifiers
- Simplify sentence structure

Target length: ${targetLength} characters (current: ${currentPrompt.length})
Return ONLY the shortened prompt, nothing else.`;

    try {
      const response = await openaiClient.responses.create({
        model: "gpt-5-mini",
        instructions: systemPrompt,
        input: currentPrompt,
      });

      const shortened = response.output_text?.trim();
      if (shortened && shortened.length < currentPrompt.length) {
        currentPrompt = shortened;
        console.log(
          `[Kling] Shortened to ${currentPrompt.length} chars (attempt ${attempts})`,
        );
      } else {
        console.warn(
          `[Kling] Shortening attempt ${attempts} did not reduce length`,
        );
        break;
      }
    } catch (error) {
      console.error(`[Kling] Prompt shortening failed:`, error);
      break;
    }
  }

  if (currentPrompt.length > maxLength) {
    console.warn(
      `[Kling] Could not shorten prompt below ${maxLength}, truncating...`,
    );
    currentPrompt = currentPrompt.substring(0, maxLength - 3) + "...";
  }

  return currentPrompt;
}

/**
 * Generates a new cinematic prompt that is grounded in the actual generated images.
 * This prevents the video AI from doing "weird things" when the original prompt
 * doesn't perfectly match what the image generator created.
 *
 * Flow: originalPrompt -> images -> groundedPrompt -> video
 * This ensures the video prompt describes what the images ACTUALLY show.
 */
export async function generateGroundedCinematicPrompt(
  options: GroundedPromptOptions,
): Promise<string> {
  const {
    originalCinematicPrompt,
    startImageUrl,
    endImageUrl,
    shotType,
    emotion,
    action,
  } = options;

  console.log(
    `[Kling] Generating grounded cinematic prompt for ${shotType} scene...`,
  );

  const promptConfig = {
    originalCinematicPrompt,
    shotType,
    emotion,
    action,
    hasEndImage: !!endImageUrl,
  };

  const systemPrompt = generateGroundedCinematicSystemPrompt(promptConfig);
  const userPrompt = generateGroundedCinematicUserPrompt(promptConfig);

  // Build image content array using the same pattern as other services
  const imageContent: Array<{
    type: "input_image";
    image_url: string;
    detail: "high" | "low";
  }> = [
    {
      type: "input_image",
      image_url: startImageUrl,
      detail: "high",
    },
  ];

  if (endImageUrl) {
    imageContent.push({
      type: "input_image",
      image_url: endImageUrl,
      detail: "high",
    });
  }

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-5.2",
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [...imageContent, { type: "input_text", text: userPrompt }],
        },
      ],
      text: { format: { type: "json_object" } },
    });

    const outputText = response.output_text || "{}";
    let groundedPrompt: string;

    try {
      const parsed = JSON.parse(outputText);
      groundedPrompt = parsed.groundedPrompt || originalCinematicPrompt;
    } catch {
      // If JSON parsing fails, use the raw output if it looks like a prompt
      groundedPrompt =
        outputText.length > 100 ? outputText : originalCinematicPrompt;
    }

    console.log(
      `[Kling] Grounded prompt generated (${groundedPrompt.length} chars)`,
    );

    // Apply shortening if needed to ensure it fits within Kling's limit
    const finalPrompt = await shortenPromptIfNeeded(groundedPrompt);

    console.log(
      `[Kling] Grounded prompt final (${finalPrompt.length} chars): ${finalPrompt.substring(0, 200)}...`,
    );

    return finalPrompt;
  } catch (error) {
    console.error("[Kling] Failed to generate grounded prompt:", error);
    console.log("[Kling] Falling back to original cinematic prompt");
    return originalCinematicPrompt;
  }
}

/**
 * Builds Kling prompt optimized for image-to-video generation.
 *
 * Key principles from Kling 2.6 Pro best practices:
 * - Focus on MOTION instructions (scene is already in the image)
 * - Use "++" for emphasis on critical elements
 * - One clear action, one camera movement
 * - Add rigidity language to prevent morphing
 */
export function buildKlingPrompt(
  cinematicPrompt: string,
  shotType: ShotType,
  emotion: string,
): string {
  let basePrompt: string;

  if (shotType === "a-roll") {
    // A-roll: Focus on natural speaking motion, subtle movements
    basePrompt = `${cinematicPrompt}. ++Person speaks naturally to camera++, subtle lip movements, ${emotion} expression. Gentle head micro-movements, relaxed eye contact with lens. ++Face maintains exact appearance throughout++ - no morphing. ${GENTLE_MOTION_MODIFIERS}`;
  } else {
    // B-roll: Focus on product motion and camera movement, always include screen stability
    basePrompt = `${cinematicPrompt}. Smooth camera glide showcasing product. ++Product remains solid and unchanged++ - no warping or morphing. ${SCREEN_STABILITY_MODIFIERS} ${BROLL_MOTION_MODIFIERS}`;
  }

  return basePrompt;
}

// ── Kling v3 Pro Image-to-Video ─────────────────────────────────────────

export async function generateVideoV3(
  options: ImageToVideoV3Options,
): Promise<ImageToVideoResult> {
  const {
    imageUrl,
    endImageUrl,
    prompt,
    duration = 5,
    negativePrompt,
    generateAudio = false,
    dialogue,
    cfgScale,
    elements,
    multiPrompt,
    voiceIds,
    aspectRatio,
  } = options;

  let finalPrompt = prompt;
  if (generateAudio && dialogue) {
    finalPrompt = `${prompt}. The person speaks naturally and says "${dialogue}"`;
  }

  finalPrompt = await shortenPromptIfNeeded(finalPrompt);

  const finalNegativePrompt = negativePrompt || PRODUCT_NEGATIVE_PROMPT;

  console.log(
    `[Kling v3] Generating ${duration}s video from image (audio: ${generateAudio})`,
  );
  console.log(
    `[Kling v3] Prompt (${finalPrompt.length} chars): ${finalPrompt.substring(0, 200)}...`,
  );
  if (endImageUrl) {
    console.log(`[Kling v3] Using end frame image for interpolation`);
  }
  if (elements?.length) {
    console.log(`[Kling v3] Using ${elements.length} element(s) for consistency`);
  }

  try {
    const input: Record<string, unknown> = {
      start_image_url: imageUrl,
      duration: String(duration),
      negative_prompt: finalNegativePrompt,
      generate_audio: generateAudio,
    };

    // v3 uses multi_prompt OR prompt, not both
    if (multiPrompt && multiPrompt.length > 0) {
      input.multi_prompt = multiPrompt.map((mp) => ({ prompt: mp.prompt }));
      input.shot_type = "customize";
    } else {
      input.prompt = finalPrompt;
    }

    if (endImageUrl) input.end_image_url = endImageUrl;
    if (cfgScale !== undefined) input.cfg_scale = cfgScale;
    if (aspectRatio) input.aspect_ratio = aspectRatio;

    if (voiceIds && voiceIds.length > 0) {
      input.voice_ids = voiceIds;
    }

    if (elements && elements.length > 0) {
      input.elements = elements.map((el) => {
        if (el.videoUrl) {
          return { video_url: el.videoUrl };
        }
        return {
          ...(el.frontalImageUrl && { frontal_image_url: el.frontalImageUrl }),
          ...(el.referenceImageUrls && { reference_image_urls: el.referenceImageUrls }),
        };
      });
    }

    const result = await fal.subscribe(
      "fal-ai/kling-video/v3/pro/image-to-video",
      {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.forEach((log) => console.log(`[Kling v3] ${log.message}`));
          }
        },
      },
    );

    const data = result.data as KlingImageToVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in v3 generation response");
    }

    console.log(`[Kling v3] Video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Kling v3] Video generation failed:", error);
    throw error;
  }
}

export async function generateVideoV3WithRetry(
  options: ImageToVideoV3Options,
  maxRetries: number = 3,
): Promise<ImageToVideoResult> {
  let lastError: Error | null = null;
  let promptRewriteAttempts = 0;
  const maxPromptRewrites = 2;
  let currentOptions = { ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateVideoV3(currentOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message || String(error);
      const is422 =
        errorMessage.includes("422") || errorMessage.includes("Unprocessable");

      console.warn(
        `[Kling v3] Video generation attempt ${attempt}/${maxRetries} failed:`,
        errorMessage,
        is422 ? "(422 - will try rewriting prompt)" : "",
      );

      if (is422 && promptRewriteAttempts < maxPromptRewrites) {
        promptRewriteAttempts++;
        console.log(
          `[Kling v3] 422 error - rewriting prompt (attempt ${promptRewriteAttempts}/${maxPromptRewrites})`,
        );
        const rewrittenPrompt = await rewritePromptFor422(
          currentOptions.prompt,
          errorMessage,
        );
        currentOptions = { ...currentOptions, prompt: rewrittenPrompt };
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Kling v3] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("V3 video generation failed after retries");
}

export async function generateAvatar(
  options: AvatarOptions,
): Promise<AvatarResult> {
  const { imageUrl, audioUrl, prompt } = options;

  let finalPrompt = prompt || AVATAR_PROMPT;

  if (finalPrompt.length > KLING_MAX_PROMPT_LENGTH) {
    console.log(
      `[Kling Avatar v2] Prompt too long (${finalPrompt.length}/${KLING_MAX_PROMPT_LENGTH}), shortening...`,
    );
    finalPrompt = await shortenPromptIfNeeded(
      finalPrompt,
      KLING_MAX_PROMPT_LENGTH,
    );
  }

  console.log(`[Kling Avatar v2] Generating talking head video`);
  console.log(`[Kling Avatar v2] Image: ${imageUrl.substring(0, 80)}...`);
  console.log(`[Kling Avatar v2] Audio: ${audioUrl.substring(0, 80)}...`);
  console.log(
    `[Kling Avatar v2] Prompt (${finalPrompt.length} chars): ${finalPrompt.substring(0, 100)}...`,
  );

  try {
    const result = await fal.subscribe("fal-ai/kling-video/ai-avatar/v2/pro", {
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        prompt: finalPrompt,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs.forEach((log) =>
            console.log(`[Kling Avatar v2] ${log.message}`),
          );
        }
      },
    });

    const data = result.data as KlingAvatarResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in avatar response");
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
  maxRetries: number = 3,
): Promise<AvatarResult> {
  let lastError: Error | null = null;
  const currentOptions = { ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateAvatar(currentOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[Kling Avatar v2] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message,
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

export async function extendVideo(
  options: ExtendVideoOptions,
): Promise<ExtendVideoResult> {
  const { videoUrl, duration = 5 } = options;

  console.log(`[Kling O1] Extending video by ${duration}s`);
  console.log(`[Kling O1] Video URL: ${videoUrl.substring(0, 80)}...`);
  console.log(
    `[Kling O1] Prompt: Based on @Video1, generate the next shot. keep the style of the video`,
  );

  try {
    const result = await fal.subscribe(
      "fal-ai/kling-video/o1/video-to-video/reference",
      {
        input: {
          prompt:
            "Based on @Video1, generate the next shot. keep the style of the video",
          video_url: videoUrl,
          duration: String(duration) as "5" | "10",
          aspect_ratio: "auto",
        },
        logs: true,
        pollInterval: 3000,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs) {
            update.logs.forEach((log) =>
              console.log(`[Kling O1] ${log.message}`),
            );
          }
        },
      },
    );

    const data = result.data as KlingExtendVideoResponse;

    if (!data?.video?.url) {
      throw new Error("No video URL in video extension response");
    }

    console.log(`[Kling O1] Extended video generated: ${data.video.url}`);

    return {
      videoUrl: data.video.url,
      requestId: result.requestId,
    };
  } catch (error) {
    console.error("[Kling O1] Video extension failed:", error);
    throw error;
  }
}

export async function extendVideoWithRetry(
  options: ExtendVideoOptions,
  maxRetries: number = 5,
): Promise<ExtendVideoResult> {
  let lastError: Error | null = null;
  const currentOptions = { ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await extendVideo(currentOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTimeout =
        lastError.message.includes("ETIMEDOUT") ||
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("timeout");

      console.warn(
        `[Kling O1] Extend attempt ${attempt}/${maxRetries} failed:`,
        lastError.message,
        isTimeout ? "(network timeout)" : "",
      );

      if (attempt < maxRetries) {
        const baseDelay = isTimeout ? 10000 : 2000;
        const delay = baseDelay * attempt;
        console.log(`[Kling O1] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Video extension failed after retries");
}

export async function klingProMotion(
  options: MotionControlOptions,
): Promise<MotionControlResult> {
  const {
    imageUrl,
    videoUrl,
    prompt,
    keepOriginalSound = true,
    characterOrientation = "image",
  } = options;

  const input: Record<string, unknown> = {
    image_url: imageUrl,
    video_url: videoUrl,
    character_orientation: characterOrientation,
    keep_original_sound: keepOriginalSound,
    aspect_ratio: "9:16",
  };

  if (prompt) {
    input.prompt = prompt;
  }

  // Step 1: Submit the request to the queue
  const { request_id } = await fal.queue.submit(
    "fal-ai/kling-video/v2.6/pro/motion-control",
    { input },
  );

  // Step 2: Poll for status until complete
  const POLL_INTERVAL = 5000;
  const MAX_WAIT_TIME = 40 * 60 * 1000; // 40 minutes max
  const startTime = Date.now();

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_WAIT_TIME) {
      throw new Error(
        `Kling Pro Motion timed out after ${MAX_WAIT_TIME / 1000}s`,
      );
    }
    const status = await fal.queue.status(
      "fal-ai/kling-video/v2.6/pro/motion-control",
      { requestId: request_id, logs: true },
    );

    if (status.status === "COMPLETED") {
      console.log(
        `[Kling Pro Motion] Request completed after ${Math.round(elapsed / 1000)}s`,
      );
      break;
    }
    if (status.status === "IN_PROGRESS" && status.logs) {
      status.logs.forEach((log: { message: string }) =>
        console.log(`[Kling Pro Motion] ${log.message}`),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  // Step 3: Get the result
  const result = await fal.queue.result(
    "fal-ai/kling-video/v2.6/pro/motion-control",
    { requestId: request_id },
  );

  const data = result.data as KlingMotionControlResponse;

  if (!data?.video?.url) {
    throw new Error("No video URL in motion control response");
  }

  console.log(`[Kling Pro Motion] Video generated: ${data.video.url}`);

  return {
    videoUrl: data.video.url,
    requestId: request_id,
  };
}

export async function klingProMotionWithRetry(
  options: MotionControlOptions,
  maxRetries: number = 3,
): Promise<MotionControlResult> {
  let lastError: Error | null = null;
  const currentOptions = { ...options };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await klingProMotion(currentOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message || String(error);
      const is422 =
        errorMessage.includes("422") || errorMessage.includes("Unprocessable");
      const isTimeout =
        lastError.message.includes("ETIMEDOUT") ||
        lastError.message.includes("fetch failed") ||
        lastError.message.includes("timeout");

      console.warn(
        `[Kling Pro Motion] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message,
        isTimeout ? "(network timeout)" : "",
        is422 ? "(422 - video quality issue)" : "",
      );

      if (is422) {
        throw new Error(
          "Video rejected: The video must clearly show one person from at least the torso up. Make sure the subject is visible and not too far from camera.",
        );
      }

      if (attempt < maxRetries) {
        const baseDelay = isTimeout ? 15000 : 5000;
        const delay = baseDelay * attempt;
        console.log(`[Kling Pro Motion] Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Pro Motion generation failed after retries");
}

export const klingService = {
  generateVideoV3,
  generateVideoV3WithRetry,
  generateAvatar,
  generateAvatarWithRetry,
  extendVideo,
  extendVideoWithRetry,
  buildKlingPrompt,
  shortenPromptIfNeeded,
  rewritePromptFor422,
  generateGroundedCinematicPrompt,
  klingProMotion,
  klingProMotionWithRetry,
  PRODUCT_NEGATIVE_PROMPT,
  PRODUCT_STABILITY_MODIFIERS,
  GENTLE_MOTION_MODIFIERS,
  PRO_MOTION_PROMPT,
  KLING_MAX_PROMPT_LENGTH,
};
