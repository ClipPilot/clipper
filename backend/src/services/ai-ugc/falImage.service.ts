import { fal } from "./falClient";
import { generateImageWithGeminiDirect } from "../ad-clone/gemini.service";
import { s3Service } from "../s3.service";

const FAL_TIER_TIMEOUT_MS = 120000; // 2 minutes per FAL model tier

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${operation} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

// ── Shared types ──

export type AspectRatio =
  | "21:9"
  | "16:9"
  | "3:2"
  | "4:3"
  | "5:4"
  | "1:1"
  | "4:5"
  | "3:4"
  | "2:3"
  | "9:16";

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: AspectRatio;
  numImages?: number;
}

export interface GenerateImageWithReferencesOptions {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: AspectRatio | "auto";
  numImages?: number;
  negativePrompt?: string;
}

export interface GenerateImageResult {
  imageUrl: string;
  description?: string;
}

export interface GenerateMultipleImagesResult {
  imageUrls: string[];
  description?: string;
}

interface FalImageResponse {
  images: Array<{
    url: string;
    file_name?: string;
    content_type?: string;
  }>;
  description?: string;
}

// ── FAL subscribe helper ──

function logQueueUpdate(update: { status: string; logs?: Array<{ message: string }> }) {
  if (update.status === "IN_PROGRESS" && update.logs) {
    update.logs.forEach((log) => console.log(`[FAL_IMAGE] ${log.message}`));
  }
}

async function falSubscribe(
  model: string,
  input: Record<string, unknown>,
  timeoutMs: number,
): Promise<FalImageResponse | null> {
  try {
    const result = (await withTimeout(
      fal.subscribe(model, {
        input: input as Parameters<typeof fal.subscribe>[1] extends { input: infer I } ? I : never,
        logs: true,
        onQueueUpdate: logQueueUpdate,
      }),
      timeoutMs,
      `FAL ${model}`,
    )) as { data: FalImageResponse };

    if (result?.data?.images?.[0]?.url) {
      return result.data;
    }
    console.warn(`[FAL_IMAGE] ${model} returned no image`);
    return null;
  } catch (err) {
    console.warn(`[FAL_IMAGE] ${model} failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ── Gemini fallback ──

async function geminiFallback(
  prompt: string,
  imageUrls?: string[],
  aspectRatio?: string,
): Promise<GenerateImageResult> {
  console.log("[FAL_IMAGE] Falling back to Gemini image generation...");
  try {
    const buffer = await generateImageWithGeminiDirect({ prompt, imageUrls, aspectRatio: aspectRatio || "9:16" });
    const tempKey = `temp/gemini-fallback/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    await s3Service.uploadBuffer(buffer, tempKey, "image/png");
    const imageUrl = await s3Service.getPresignedUrl(tempKey, 3600);
    console.log("[FAL_IMAGE] Gemini fallback succeeded");
    return { imageUrl };
  } catch (geminiError) {
    console.error(
      `[FAL_IMAGE] Gemini fallback also failed: ${geminiError instanceof Error ? geminiError.message : geminiError}`,
    );
    throw new Error(
      `Image generation failed: all providers failed — ${geminiError instanceof Error ? geminiError.message : geminiError}`,
    );
  }
}

// ── Cascade: nano-banana-2 → nano-banana-pro → Gemini ──

/**
 * Run the 3-tier image generation cascade for a single image.
 * Tier 1: nano-banana-2 (2 min) → Tier 2: nano-banana-pro (2 min) → Tier 3: Gemini
 */
async function cascadeSingleImage(
  primaryModel: string,
  proModel: string,
  input: Record<string, unknown>,
  geminiPrompt: string,
  geminiImageUrls?: string[],
  geminiAR?: string,
): Promise<GenerateImageResult> {
  // Tier 1: nano-banana-2
  console.log(`[FAL_IMAGE] Tier 1: ${primaryModel}`);
  let data = await falSubscribe(primaryModel, input, FAL_TIER_TIMEOUT_MS);
  if (data?.images?.[0]?.url) {
    return { imageUrl: data.images[0].url, description: data.description };
  }

  // Tier 2: nano-banana-pro
  console.log(`[FAL_IMAGE] Tier 2: ${proModel}`);
  data = await falSubscribe(proModel, input, FAL_TIER_TIMEOUT_MS);
  if (data?.images?.[0]?.url) {
    return { imageUrl: data.images[0].url, description: data.description };
  }

  // Tier 3: Gemini
  return geminiFallback(geminiPrompt, geminiImageUrls, geminiAR);
}

/**
 * Run the 3-tier cascade for multiple images.
 * Only FAL tiers support multi-image; Gemini falls back to single.
 */
async function cascadeMultipleImages(
  primaryModel: string,
  proModel: string,
  input: Record<string, unknown>,
): Promise<GenerateMultipleImagesResult> {
  // Tier 1: nano-banana-2
  console.log(`[FAL_IMAGE] Tier 1 (multi): ${primaryModel}`);
  let data = await falSubscribe(primaryModel, input, FAL_TIER_TIMEOUT_MS);
  if (data?.images?.length) {
    return { imageUrls: data.images.map((img) => img.url), description: data.description };
  }

  // Tier 2: nano-banana-pro
  console.log(`[FAL_IMAGE] Tier 2 (multi): ${proModel}`);
  data = await falSubscribe(proModel, input, FAL_TIER_TIMEOUT_MS);
  if (data?.images?.length) {
    return { imageUrls: data.images.map((img) => img.url), description: data.description };
  }

  throw new Error("Image generation failed: all FAL tiers failed for multi-image request");
}

// ── Public API ──

/**
 * Generate image (text-to-image).
 * Cascade: nano-banana-2 → nano-banana-pro → Gemini
 */
export async function generateImage(
  options: GenerateImageOptions & { usePro?: boolean },
): Promise<GenerateImageResult> {
  const { prompt, aspectRatio = "9:16", numImages = 1 } = options;

  const input: Record<string, unknown> = {
    prompt,
    num_images: numImages,
    aspect_ratio: aspectRatio,
    output_format: "png",
  };

  return cascadeSingleImage(
    "fal-ai/nano-banana-2",
    "fal-ai/nano-banana-pro",
    input,
    prompt,
    undefined,
    aspectRatio,
  );
}

/**
 * Generate image with reference images (image-to-image).
 * Cascade: nano-banana-2/edit → nano-banana-pro/edit → Gemini
 */
export async function generateImageWithReferences(
  options: GenerateImageWithReferencesOptions & { usePro?: boolean },
): Promise<GenerateImageResult> {
  const { prompt, imageUrls, aspectRatio = "9:16", numImages = 1, negativePrompt } = options;
  const fallbackAR = aspectRatio === "auto" ? "9:16" : aspectRatio;

  const input: Record<string, unknown> = {
    prompt,
    image_urls: imageUrls,
    num_images: numImages,
    aspect_ratio: aspectRatio,
    output_format: "png",
  };
  if (negativePrompt) input.negative_prompt = negativePrompt;

  return cascadeSingleImage(
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-pro/edit",
    input,
    prompt,
    imageUrls,
    fallbackAR,
  );
}

/**
 * Generate multiple images (text-to-image).
 * Cascade: nano-banana-2 → nano-banana-pro (no Gemini for multi)
 */
export async function generateMultipleImages(
  options: GenerateImageOptions & { usePro?: boolean },
): Promise<GenerateMultipleImagesResult> {
  const { prompt, aspectRatio = "9:16", numImages = 4 } = options;

  const input: Record<string, unknown> = {
    prompt,
    num_images: numImages,
    aspect_ratio: aspectRatio,
    output_format: "png",
  };

  return cascadeMultipleImages("fal-ai/nano-banana-2", "fal-ai/nano-banana-pro", input);
}

/**
 * Generate multiple images with references (image-to-image).
 * Cascade: nano-banana-2/edit → nano-banana-pro/edit (no Gemini for multi)
 */
export async function generateMultipleImagesWithReferences(
  options: GenerateImageWithReferencesOptions & { usePro?: boolean },
): Promise<GenerateMultipleImagesResult> {
  const { prompt, imageUrls, aspectRatio = "9:16", numImages = 4, negativePrompt } = options;

  const input: Record<string, unknown> = {
    prompt,
    image_urls: imageUrls,
    num_images: numImages,
    aspect_ratio: aspectRatio,
    output_format: "png",
  };
  if (negativePrompt) input.negative_prompt = negativePrompt;

  return cascadeMultipleImages("fal-ai/nano-banana-2/edit", "fal-ai/nano-banana-pro/edit", input);
}

/**
 * Generate image with retry logic — uses the cascade internally.
 */
export async function generateImageWithRetry(
  options: GenerateImageOptions & { imageUrls?: string[]; usePro?: boolean },
  maxRetries: number = 3,
): Promise<GenerateImageResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (options.imageUrls && options.imageUrls.length > 0) {
        return await generateImageWithReferences({
          prompt: options.prompt,
          imageUrls: options.imageUrls,
          aspectRatio: options.aspectRatio,
          numImages: options.numImages,
          usePro: options.usePro,
        });
      } else {
        return await generateImage(options);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[FAL_IMAGE] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[FAL_IMAGE] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed to generate image after retries");
}

export const falImageService = {
  generateImage,
  generateImageWithReferences,
  generateMultipleImages,
  generateMultipleImagesWithReferences,
  generateImageWithRetry,
};
