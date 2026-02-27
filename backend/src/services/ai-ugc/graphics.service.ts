import { generateImage, generateImageWithReferences, generateMultipleImages, generateMultipleImagesWithReferences } from "./falImage.service";
import { s3Service } from "../s3.service";
import { composePrompt } from "./graphicsPrompts";
import type { AspectRatio } from "./falImage.service";
import type { StylePreset } from "./graphicsPrompts";

export type GraphicType =
  | "instagram-ad"
  | "facebook-ad"
  | "product-showcase"
  | "banner-display-ad"
  | "custom";

export type GenerationMode = "variations" | "carousel";

export interface GenerateGraphicsOptions {
  teamId: number;
  prompt: string;
  graphicType: GraphicType;
  stylePreset: StylePreset;
  aspectRatio: AspectRatio;
  mode: GenerationMode;
  productImageKeys?: string[];
}

export interface GeneratedGraphic {
  s3Key: string;
  presignedUrl: string;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from FAL: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function generateBatch(
  prompt: string,
  numImages: number,
  aspectRatio: AspectRatio,
  referenceUrls?: string[],
): Promise<string[]> {
  if (referenceUrls && referenceUrls.length > 0) {
    const result = await generateMultipleImagesWithReferences({
      prompt,
      imageUrls: referenceUrls,
      aspectRatio,
      numImages,
    });
    return result.imageUrls;
  }
  const result = await generateMultipleImages({
    prompt,
    aspectRatio,
    numImages,
  });
  return result.imageUrls;
}

function buildPrompt(
  userPrompt: string,
  graphicType: GraphicType,
  stylePreset: StylePreset,
  variant: "clean" | "bold",
  hasReferences: boolean,
): string {
  return composePrompt({ stylePreset, graphicType, variant, userPrompt, hasReferences });
}

async function generateVariations(
  prompt: string,
  graphicType: GraphicType,
  stylePreset: StylePreset,
  aspectRatio: AspectRatio,
  referenceUrls?: string[],
): Promise<string[]> {
  const hasRefs = !!referenceUrls?.length;
  const cleanPrompt = buildPrompt(prompt, graphicType, stylePreset, "clean", hasRefs);
  const boldPrompt = buildPrompt(prompt, graphicType, stylePreset, "bold", hasRefs);

  const [cleanUrls, boldUrls] = await Promise.all([
    generateBatch(cleanPrompt, 3, aspectRatio, referenceUrls),
    generateBatch(boldPrompt, 1, aspectRatio, referenceUrls),
  ]);

  return [...cleanUrls, ...boldUrls];
}

async function generateCarousel(
  prompt: string,
  graphicType: GraphicType,
  stylePreset: StylePreset,
  aspectRatio: AspectRatio,
  referenceUrls?: string[],
): Promise<string[]> {
  const hasRefs = !!referenceUrls?.length;
  const heroPrompt = buildPrompt(prompt, graphicType, stylePreset, "clean", hasRefs);

  console.log("[GRAPHICS] Carousel: generating hero image...");

  let heroUrl: string;
  if (referenceUrls && referenceUrls.length > 0) {
    const result = await generateImageWithReferences({
      prompt: heroPrompt,
      imageUrls: referenceUrls,
      aspectRatio,
      numImages: 1,
    });
    heroUrl = result.imageUrl;
  } else {
    const result = await generateImage({
      prompt: heroPrompt,
      aspectRatio,
      numImages: 1,
    });
    heroUrl = result.imageUrl;
  }

  console.log("[GRAPHICS] Carousel: generating 3 continuation slides from hero...");

  const continuationPrompt = buildPrompt(
    `${prompt}\n\nThis is part of a carousel series. Create a visually cohesive continuation slide matching the exact style, color palette, lighting, and mood of the reference. Explore a different angle or perspective — creative framing while keeping brand feel consistent.`,
    graphicType,
    stylePreset,
    "clean",
    true,
  );

  const allRefs = [heroUrl, ...(referenceUrls || [])];
  const continuationResult = await generateMultipleImagesWithReferences({
    prompt: continuationPrompt,
    imageUrls: allRefs,
    aspectRatio,
    numImages: 3,
  });

  return [heroUrl, ...continuationResult.imageUrls];
}

export async function generateGraphics(
  options: GenerateGraphicsOptions,
): Promise<GeneratedGraphic[]> {
  const { teamId, prompt, graphicType, stylePreset, aspectRatio, mode, productImageKeys } = options;

  console.log(`[GRAPHICS] Generating 4 graphics (mode: ${mode}, preset: ${stylePreset}) for team ${teamId}, type: ${graphicType}, ratio: ${aspectRatio}`);

  let referenceUrls: string[] | undefined;
  if (productImageKeys && productImageKeys.length > 0) {
    referenceUrls = await Promise.all(
      productImageKeys.map((key) => s3Service.getPresignedUrl(key, 600)),
    );
  }

  const imageUrls = mode === "carousel"
    ? await generateCarousel(prompt, graphicType, stylePreset, aspectRatio, referenceUrls)
    : await generateVariations(prompt, graphicType, stylePreset, aspectRatio, referenceUrls);

  const timestamp = Date.now();
  const results: GeneratedGraphic[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const buffer = await fetchImageBuffer(imageUrls[i]);
    const s3Key = `teams/${teamId}/graphics/${timestamp}_${i}.png`;
    await s3Service.uploadBuffer(buffer, s3Key, "image/png");
    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 3600);
    results.push({ s3Key, presignedUrl });
  }

  console.log(`[GRAPHICS] Successfully generated and uploaded ${results.length} graphics`);
  return results;
}

export const graphicsService = {
  generateGraphics,
};
