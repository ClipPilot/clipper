import { fal } from "@fal-ai/client";
import { config } from "../config/env";

fal.config({
  credentials: config.fal.apiKey,
});

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
}

export interface GenerateImageResult {
  imageUrl: string;
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
  options: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const { prompt, aspectRatio = "3:4", numImages = 1 } = options;

  console.log(`[FAL_IMAGE] Text-to-image with aspect ratio ${aspectRatio}`);

  const result = (await fal.subscribe("fal-ai/nano-banana", {
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
  })) as { data: FalImageResponse };

  if (!result.data?.images?.[0]?.url) {
    throw new Error("FAL AI did not return an image");
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
  const { prompt, imageUrls, aspectRatio = "3:4", numImages = 1, usePro = false } = options;

  const model = usePro ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana/edit";

  console.log(
    `[FAL_IMAGE] Image-to-image with ${imageUrls.length} reference images, aspect ratio ${aspectRatio}, model: ${model}`,
  );

  const result = (await fal.subscribe(model, {
    input: {
      prompt,
      image_urls: imageUrls,
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
  })) as { data: FalImageResponse };

  if (!result.data?.images?.[0]?.url) {
    throw new Error("FAL AI did not return an image");
  }

  return {
    imageUrl: result.data.images[0].url,
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
  generateImageWithRetry,
};
