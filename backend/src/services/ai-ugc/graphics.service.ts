import { generateImage, generateImageWithReferences, generateMultipleImages, generateMultipleImagesWithReferences } from "./falImage.service";
import { s3Service } from "../s3.service";
import type { AspectRatio } from "./falImage.service";

export type GraphicType =
  | "instagram-ad"
  | "facebook-ad"
  | "product-showcase"
  | "banner-display-ad"
  | "custom";

const GRAPHIC_TYPE_PROMPTS: Record<GraphicType, { clean: string; bold: string }> = {
  "instagram-ad": {
    clean: "Professional, polished Instagram ad. Clean minimal layout with muted, sophisticated color palette. Realistic product photography style, not illustrated or cartoonish. Subtle neutral background, no excessive gradients or neon colors. Leave negative space for text. The look should match real brand ads from Apple, Nike, or Glossier — understated, elegant, commercial.",
    bold: "High-impact Instagram ad with one striking accent color against a dark or contrasting background. Bold, editorial feel — think a fashion campaign or a premium tech launch. Dramatic lighting, strong contrast, cinematic mood. Still professional and polished, not chaotic.",
  },
  "facebook-ad": {
    clean: "Professional Facebook ad graphic. Clean, corporate, trustworthy feel. Realistic photography style with natural lighting. Muted tones, white or light neutral backgrounds. Simple composition with one clear focal point. No busy patterns, no oversaturated colors. Should look like a real paid ad from a Fortune 500 brand.",
    bold: "Eye-catching Facebook ad with a bold color pop and strong contrast. One dominant accent color against a clean background. Confident, modern, slightly editorial. Think a Spotify Wrapped or Mailchimp campaign — playful but still polished and professional.",
  },
  "product-showcase": {
    clean: "Premium e-commerce product photo on a clean white or light gray seamless background. Studio photography with soft, even lighting. Subtle shadow grounding the product. No props, no text, no decorations — just the product presented cleanly. Think Amazon hero image or Shopify product listing. Photorealistic, commercial grade.",
    bold: "Dramatic product hero shot with moody, cinematic lighting. Dark or rich colored background with the product lit by a single strong light source. High contrast, luxurious feel. Think Apple product reveal or premium fragrance ad. Still photorealistic, not illustrated.",
  },
  "banner-display-ad": {
    clean: "Clean, professional display ad graphic. Flat, minimal design with one or two brand colors max. Simple layout with clear visual hierarchy. Solid or subtly textured background — no busy patterns. Should look like a real Google Display Network or programmatic ad. Corporate, restrained, conversion-focused.",
    bold: "Bold display banner with a striking color block design and strong geometric composition. High contrast, attention-grabbing from a distance. One punchy accent color. Think a premium brand takeover ad — impactful but not cluttered.",
  },
  custom: {
    clean: "Professional, clean advertising graphic. Realistic style, not illustrated or AI-looking. Muted, sophisticated color palette with neutral backgrounds. Minimal composition, no clutter. Should look like it was produced by a professional design agency for a real brand campaign.",
    bold: "Creative, editorial advertising graphic with bold color choices and dramatic composition. Striking visual impact with one strong accent. Confident and artistic but still commercially polished. Think award-winning ad campaign.",
  },
};

export type GenerationMode = "variations" | "carousel";

export interface GenerateGraphicsOptions {
  teamId: number;
  prompt: string;
  graphicType: GraphicType;
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
      usePro: true,
    });
    return result.imageUrls;
  }
  const result = await generateMultipleImages({
    prompt,
    aspectRatio,
    numImages,
    usePro: true,
  });
  return result.imageUrls;
}

async function generateVariations(
  prompt: string,
  graphicType: GraphicType,
  aspectRatio: AspectRatio,
  referenceUrls?: string[],
): Promise<string[]> {
  const { clean, bold } = GRAPHIC_TYPE_PROMPTS[graphicType];
  const refInstruction = referenceUrls?.length
    ? "IMPORTANT: Reference images are provided. You MUST use them as the primary visual basis. Keep the same subject, product, colors, and composition from the reference images. The user's request describes how to modify or build upon the reference — do NOT ignore the reference images or generate unrelated content.\n\n"
    : "";
  const cleanPrompt = `${refInstruction}${clean}\n\nUser request: ${prompt}`;
  const boldPrompt = `${refInstruction}${bold}\n\nUser request: ${prompt}`;

  const [cleanUrls, boldUrls] = await Promise.all([
    generateBatch(cleanPrompt, 3, aspectRatio, referenceUrls),
    generateBatch(boldPrompt, 1, aspectRatio, referenceUrls),
  ]);

  return [...cleanUrls, ...boldUrls];
}

async function generateCarousel(
  prompt: string,
  graphicType: GraphicType,
  aspectRatio: AspectRatio,
  referenceUrls?: string[],
): Promise<string[]> {
  const { clean } = GRAPHIC_TYPE_PROMPTS[graphicType];
  const refInstruction = referenceUrls?.length
    ? "IMPORTANT: Reference images are provided. You MUST use them as the primary visual basis. Keep the same subject, product, colors, and composition from the reference images. The user's request describes how to modify or build upon the reference — do NOT ignore the reference images or generate unrelated content.\n\n"
    : "";
  const heroPrompt = `${refInstruction}${clean}\n\nUser request: ${prompt}`;

  console.log("[GRAPHICS] Carousel: generating hero image...");

  let heroUrl: string;
  if (referenceUrls && referenceUrls.length > 0) {
    const result = await generateImageWithReferences({
      prompt: heroPrompt,
      imageUrls: referenceUrls,
      aspectRatio,
      numImages: 1,
      usePro: true,
    });
    heroUrl = result.imageUrl;
  } else {
    const result = await generateImage({
      prompt: heroPrompt,
      aspectRatio,
      numImages: 1,
      usePro: true,
    });
    heroUrl = result.imageUrl;
  }

  console.log("[GRAPHICS] Carousel: generating 3 continuation slides from hero...");

  const continuationPrompt = `${clean}\n\nThis image is part of an Instagram carousel series. Create a visually cohesive continuation slide that matches the exact same style, color palette, lighting, and mood as the reference image. Explore a different angle, composition, or perspective of the same concept — be creative with the framing while keeping the brand feel consistent.\n\nUser request: ${prompt}`;

  const allRefs = [heroUrl, ...(referenceUrls || [])];
  const continuationResult = await generateMultipleImagesWithReferences({
    prompt: continuationPrompt,
    imageUrls: allRefs,
    aspectRatio,
    numImages: 3,
    usePro: true,
  });

  return [heroUrl, ...continuationResult.imageUrls];
}

export async function generateGraphics(
  options: GenerateGraphicsOptions,
): Promise<GeneratedGraphic[]> {
  const { teamId, prompt, graphicType, aspectRatio, mode, productImageKeys } = options;

  console.log(`[GRAPHICS] Generating 4 graphics (mode: ${mode}) for team ${teamId}, type: ${graphicType}, ratio: ${aspectRatio}`);

  let referenceUrls: string[] | undefined;
  if (productImageKeys && productImageKeys.length > 0) {
    referenceUrls = await Promise.all(
      productImageKeys.map((key) => s3Service.getPresignedUrl(key, 600)),
    );
  }

  const imageUrls = mode === "carousel"
    ? await generateCarousel(prompt, graphicType, aspectRatio, referenceUrls)
    : await generateVariations(prompt, graphicType, aspectRatio, referenceUrls);

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
