import { fal } from "./falClient";
import { generateImageWithGeminiDirect } from "../ad-clone/gemini.service";
import { s3Service } from "../s3.service";

const FAL_TIMEOUT_MS = 120_000;
const FAL_MODEL = "fal-ai/nano-banana-pro";
const FAL_MODEL_EDIT = "fal-ai/nano-banana-pro/edit";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

export type AspectRatio = "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16";

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
  images: Array<{ url: string; file_name?: string; content_type?: string }>;
  description?: string;
}

function logQueueUpdate(update: { status: string; logs?: Array<{ message: string }> }) {
  if (update.status === "IN_PROGRESS" && update.logs) {
    update.logs.forEach((log) => console.log(`[FAL_IMAGE] ${log.message}`));
  }
}

async function falSubscribe(model: string, input: Record<string, unknown>): Promise<FalImageResponse | null> {
  try {
    const result = (await withTimeout(
      fal.subscribe(model, {
        input: input as Parameters<typeof fal.subscribe>[1] extends { input: infer I } ? I : never,
        logs: true,
        onQueueUpdate: logQueueUpdate,
      }),
      FAL_TIMEOUT_MS,
      `FAL ${model}`,
    )) as { data: FalImageResponse };

    if (result?.data?.images?.[0]?.url) return result.data;
    console.warn(`[FAL_IMAGE] ${model} returned no image`);
    return null;
  } catch (err) {
    console.warn(`[FAL_IMAGE] ${model} failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function geminiFallback(prompt: string, imageUrls?: string[], aspectRatio?: string): Promise<GenerateImageResult> {
  console.log("[FAL_IMAGE] Falling back to Gemini...");
  const buffer = await generateImageWithGeminiDirect({
    prompt,
    imageUrls,
    aspectRatio: aspectRatio || "9:16",
  });
  const tempKey = `temp/gemini-fallback/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
  await s3Service.uploadBuffer(buffer, tempKey, "image/png");
  const imageUrl = await s3Service.getPresignedUrl(tempKey, 3600);
  return { imageUrl };
}

// ── Public API ──

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResult> {
  const { prompt, aspectRatio = "9:16", numImages = 1 } = options;
  const input = { prompt, num_images: numImages, aspect_ratio: aspectRatio, output_format: "png" };

  const data = await falSubscribe(FAL_MODEL, input);
  if (data?.images?.[0]?.url) return { imageUrl: data.images[0].url, description: data.description };

  return geminiFallback(prompt, undefined, aspectRatio);
}

export async function generateImageWithReferences(options: GenerateImageWithReferencesOptions): Promise<GenerateImageResult> {
  const { prompt, imageUrls, aspectRatio = "9:16", numImages = 1, negativePrompt } = options;
  const fallbackAR = aspectRatio === "auto" ? "9:16" : aspectRatio;
  const input: Record<string, unknown> = { prompt, image_urls: imageUrls, num_images: numImages, aspect_ratio: aspectRatio, output_format: "png" };
  if (negativePrompt) input.negative_prompt = negativePrompt;

  const data = await falSubscribe(FAL_MODEL_EDIT, input);
  if (data?.images?.[0]?.url) return { imageUrl: data.images[0].url, description: data.description };

  return geminiFallback(prompt, imageUrls, fallbackAR);
}

export async function generateMultipleImages(options: GenerateImageOptions): Promise<GenerateMultipleImagesResult> {
  const { prompt, aspectRatio = "9:16", numImages = 4 } = options;
  const input = { prompt, num_images: numImages, aspect_ratio: aspectRatio, output_format: "png" };

  const data = await falSubscribe(FAL_MODEL, input);
  if (data?.images?.length) return { imageUrls: data.images.map((img) => img.url), description: data.description };

  throw new Error("Image generation failed: FAL returned no images for multi-image request");
}

export async function generateMultipleImagesWithReferences(options: GenerateImageWithReferencesOptions): Promise<GenerateMultipleImagesResult> {
  const { prompt, imageUrls, aspectRatio = "9:16", numImages = 4, negativePrompt } = options;
  const input: Record<string, unknown> = { prompt, image_urls: imageUrls, num_images: numImages, aspect_ratio: aspectRatio, output_format: "png" };
  if (negativePrompt) input.negative_prompt = negativePrompt;

  const data = await falSubscribe(FAL_MODEL_EDIT, input);
  if (data?.images?.length) return { imageUrls: data.images.map((img) => img.url), description: data.description };

  throw new Error("Image generation failed: FAL returned no images for multi-image request");
}

export async function generateImageWithRetry(
  options: GenerateImageOptions & { imageUrls?: string[] },
  maxRetries: number = 3,
): Promise<GenerateImageResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (options.imageUrls?.length) {
        return await generateImageWithReferences({
          prompt: options.prompt,
          imageUrls: options.imageUrls,
          aspectRatio: options.aspectRatio,
          numImages: options.numImages,
        });
      }
      return await generateImage(options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[FAL_IMAGE] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
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
