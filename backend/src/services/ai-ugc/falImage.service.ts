import { fal } from "./falClient";

const FAL_TIMEOUT_MS = 300000; // 5 minutes max per image generation

function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

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

/**
 * Generate image using FAL AI's nano-banana model (text-to-image)
 * Use this when NO reference images are provided
 */
export async function generateImage(
  options: GenerateImageOptions & { usePro?: boolean },
): Promise<GenerateImageResult> {
  const { prompt, aspectRatio = "3:4", numImages = 1, usePro = false } = options;

  const model = usePro ? "fal-ai/nano-banana-pro" : "fal-ai/nano-banana";
  console.log(`[FAL_IMAGE] Text-to-image with ${model}, aspect ratio ${aspectRatio}`);

  const result = (await withTimeout(
    fal.subscribe(model, {
      input: {
        prompt,
        num_images: numImages,
        aspect_ratio: aspectRatio,
        output_format: "png",
        limit_generations: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs
            .map((log: { message: string }) => log.message)
            .forEach((msg: string) => {
              console.log(`[FAL_IMAGE] ${msg}`);
            });
        }
      },
    }),
    FAL_TIMEOUT_MS,
    "FAL text-to-image"
  )) as { data: FalImageResponse };

  if (!result.data?.images?.[0]?.url) {
    throw new Error("Image generation did not return an image");
  }

  return {
    imageUrl: result.data.images[0].url,
    description: result.data.description,
  };
}

/**
 * Generate image using FAL AI's nano-banana/edit model (image-to-image)
 * Use this when reference images ARE provided
 * The reference images guide the generation to maintain consistency
 */
export async function generateImageWithReferences(
  options: GenerateImageWithReferencesOptions & { usePro?: boolean },
): Promise<GenerateImageResult> {
  const { prompt, imageUrls, aspectRatio = "3:4", numImages = 1, usePro = false, negativePrompt } = options;

  const model = usePro ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana/edit";

  console.log(
    `[FAL_IMAGE] Image-to-image with ${imageUrls.length} reference images, aspect ratio ${aspectRatio}, model: ${model}`,
  );

  const input: Record<string, unknown> = {
    prompt,
    image_urls: imageUrls,
    num_images: numImages,
    aspect_ratio: aspectRatio,
    output_format: "png",
    limit_generations: true,
  };

  if (negativePrompt) {
    input.negative_prompt = negativePrompt;
  }

  const result = (await withTimeout(
    fal.subscribe(model, {
      input: input as Parameters<typeof fal.subscribe>[1] extends { input: infer I } ? I : never,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs
            .map((log: { message: string }) => log.message)
            .forEach((msg: string) => {
              console.log(`[FAL_IMAGE] ${msg}`);
            });
        }
      },
    }),
    FAL_TIMEOUT_MS,
    "FAL image-to-image"
  )) as { data: FalImageResponse };

  if (!result.data?.images?.[0]?.url) {
    throw new Error("Image generation did not return an image");
  }

  return {
    imageUrl: result.data.images[0].url,
    description: result.data.description,
  };
}

/**
 * Generate multiple images using FAL AI (text-to-image)
 * Returns all generated images instead of just the first one
 */
export async function generateMultipleImages(
  options: GenerateImageOptions & { usePro?: boolean },
): Promise<GenerateMultipleImagesResult> {
  const { prompt, aspectRatio = "3:4", numImages = 4, usePro = false } = options;

  const model = usePro ? "fal-ai/nano-banana-pro" : "fal-ai/nano-banana";
  console.log(`[FAL_IMAGE] Multi text-to-image with ${model}, ${numImages} images, aspect ratio ${aspectRatio}`);

  const result = (await withTimeout(
    fal.subscribe(model, {
      input: {
        prompt,
        num_images: numImages,
        aspect_ratio: aspectRatio,
        output_format: "png",
        limit_generations: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs
            .map((log: { message: string }) => log.message)
            .forEach((msg: string) => {
              console.log(`[FAL_IMAGE] ${msg}`);
            });
        }
      },
    }),
    FAL_TIMEOUT_MS,
    "FAL multi text-to-image"
  )) as { data: FalImageResponse };

  if (!result.data?.images?.length) {
    throw new Error("Image generation did not return any images");
  }

  return {
    imageUrls: result.data.images.map((img) => img.url),
    description: result.data.description,
  };
}

/**
 * Generate multiple images using FAL AI (image-to-image with references)
 * Returns all generated images instead of just the first one
 */
export async function generateMultipleImagesWithReferences(
  options: GenerateImageWithReferencesOptions & { usePro?: boolean },
): Promise<GenerateMultipleImagesResult> {
  const { prompt, imageUrls, aspectRatio = "3:4", numImages = 4, usePro = false, negativePrompt } = options;

  const model = usePro ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana/edit";

  console.log(
    `[FAL_IMAGE] Multi image-to-image with ${imageUrls.length} references, ${numImages} images, aspect ratio ${aspectRatio}, model: ${model}`,
  );

  const input: Record<string, unknown> = {
    prompt,
    image_urls: imageUrls,
    num_images: numImages,
    aspect_ratio: aspectRatio,
    output_format: "png",
    limit_generations: true,
  };

  if (negativePrompt) {
    input.negative_prompt = negativePrompt;
  }

  const result = (await withTimeout(
    fal.subscribe(model, {
      input: input as Parameters<typeof fal.subscribe>[1] extends { input: infer I } ? I : never,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          update.logs
            .map((log: { message: string }) => log.message)
            .forEach((msg: string) => {
              console.log(`[FAL_IMAGE] ${msg}`);
            });
        }
      },
    }),
    FAL_TIMEOUT_MS,
    "FAL multi image-to-image"
  )) as { data: FalImageResponse };

  if (!result.data?.images?.length) {
    throw new Error("Image generation did not return any images");
  }

  return {
    imageUrls: result.data.images.map((img) => img.url),
    description: result.data.description,
  };
}

/**
 * Generate image with retry logic - automatically chooses the right endpoint
 * based on whether reference images are provided
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
      console.error(
        `[FAL_IMAGE] Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message,
      );

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
