import { GenerateSceneImageJob } from "../../services/sqs.service";

export const UGC_IPHONE_STYLE = `A vertical 9:16 UGC-style video frame captured on an iPhone. The composition is a medium-wide portrait, framed at true eye-level with a slightly forward-leaning posture for conversational authority.

Camera behavior uses the native iPhone lens (26mm equivalent): slightly wide, honest perspective, mild barrel softness at edges, minimal compression. Only tiny pockets of neural blur appear around hair edges—true iPhone depth-map artifacts.

Lighting is "Available Light": a mix of cool overcast daylight filtering through a window and warm tungsten from interior lights, creating imperfect balance and natural falloff. Shadows are soft but asymmetric. ISO noise from 500–900 sits naturally in midtones, producing sensor grain and mild vignetting (12% falloff).

Skin is rendered with natural texture: visible micro pores across the nose and cheeks, faint peach fuzz catching sidelight along the jawline, subtle stubble shadow density variation if male, and soft lip line diffusion. Natural oils break through on the forehead and nose bridge; no foundation, no filter. Faint dark circles sit under the eyes—realistic, lived-in.

Reality details: gentle 35mm film grain, light fingerprint smudge on lens glass, tiny dust haze in the air, and minimal chromatic aberration around high-contrast edges. No cinematic bloom, no studio finish.

Styling: raw UGC realism, available indoor light, mixed color temperature, minimal depth blur, slight lens smudge, visible ISO noise, no cinematic polish, emphasis on authenticity and true iPhone capture.`;

export type FrameType = "start" | "end";

export interface BRollShotData {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
}

export interface CharacterAppearance {
  gender?: string | null;
  ageRange?: string | null;
  skinTone?: string | null;
  hairColor?: string | null;
  hairStyle?: string | null;
  eyeColor?: string | null;
  bodyType?: string | null;
}

export interface ImagePositions {
  supportingCount: number;
  hasOriginal: boolean;
  hasCharacter: boolean;
  productCount: number;
}

export function buildCharacterDescription(appearance: CharacterAppearance): string {
  const parts: string[] = [];
  if (appearance.gender) parts.push(appearance.gender);
  if (appearance.ageRange) parts.push(`${appearance.ageRange} years old`);
  if (appearance.skinTone) parts.push(`${appearance.skinTone} skin tone`);
  if (appearance.hairColor) parts.push(`${appearance.hairColor} hair`);
  if (appearance.eyeColor) parts.push(`${appearance.eyeColor} eyes`);
  if (appearance.bodyType) parts.push(`${appearance.bodyType} build`);
  return parts.join(", ");
}

export function buildBRollShotPrompt(
  shot: BRollShotData,
  shotIndex: number,
  totalShots: number,
  sceneData: GenerateSceneImageJob["sceneData"],
  hasReferenceImages: boolean,
  productName?: string,
  userRefinement?: string,
  characterAppearance?: CharacterAppearance,
  imagePositions?: ImagePositions,
): string {
  const parts: string[] = [];

  if (imagePositions && hasReferenceImages) {
    let position = 1;
    const positionGuide: string[] = [
      "*** REFERENCE IMAGE GUIDE (in order of priority): ***",
    ];

    if (imagePositions.supportingCount > 0) {
      for (let i = 0; i < imagePositions.supportingCount; i++) {
        positionGuide.push(
          `Image ${position}: USER'S REFERENCE IMAGE - This is the MOST IMPORTANT image. Replicate its visual style, composition, colors, and details EXACTLY.`,
        );
        position++;
      }
    }

    if (imagePositions.hasOriginal) {
      positionGuide.push(
        `Image ${position}: ORIGINAL IMAGE - Create a variation of this, keeping similar composition but with changes based on user instructions.`,
      );
      position++;
    }

    if (imagePositions.hasCharacter) {
      positionGuide.push(
        `Image ${position}: CHARACTER REFERENCE - Match this person's appearance if any hands/person shown.`,
      );
      position++;
    }

    if (imagePositions.productCount > 0) {
      for (let i = 0; i < imagePositions.productCount; i++) {
        positionGuide.push(
          `Image ${position}: PRODUCT REFERENCE - Use for product visual consistency.`,
        );
        position++;
      }
    }

    positionGuide.push("");
    parts.push(...positionGuide);
  }

  if (userRefinement) {
    parts.push(
      "*** HIGHEST PRIORITY - USER INSTRUCTIONS (MUST FOLLOW): ***",
      userRefinement,
      "",
      "The above user instructions override any conflicting guidance below. Follow them exactly.",
      "",
    );
  }

  if (imagePositions?.supportingCount && imagePositions.supportingCount > 0) {
    parts.push(
      "*** CRITICAL - USER'S REFERENCE IMAGE (Image 1): ***",
      "The FIRST reference image is provided by the user. This is your PRIMARY visual guide.",
      "You MUST replicate the visual style, composition, layout, colors, and specific details shown in this image.",
      "This image shows EXACTLY what the user wants - match it as closely as possible.",
      "If this is an app screenshot or product screen, replicate that EXACT screen.",
      "",
    );
  }

  if (imagePositions?.hasOriginal) {
    const originalPos = (imagePositions?.supportingCount || 0) + 1;
    parts.push(
      `*** VARIATION MODE (Image ${originalPos}): ***`,
      "Create a VARIATION of the original image provided.",
      "Keep the same general composition and style, but generate a new version with subtle differences.",
      "The result should look like a different take/angle of the same scene.",
      "",
    );
  }

  if (hasReferenceImages) {
    const characterDesc = characterAppearance
      ? buildCharacterDescription(characterAppearance)
      : null;

    if (characterDesc) {
      parts.push(
        `CHARACTER REFERENCE: If any person or hands are shown, they MUST match: ${characterDesc}. Maintain the same race, skin color, and physical features.`,
        "",
      );
    }

    if (productName) {
      const productDesc = `"${productName}"`;
      parts.push(
        `PRODUCT REFERENCE: Use the product reference images to maintain consistent visual identity. Feature ${productDesc} as shown in references.`,
        "",
      );
    }
  }

  if (productName) {
    parts.push(
      `PRODUCT: ${productName}`,
      `Generate a B-roll shot featuring "${productName}" - ensure the product is clearly identifiable.`,
      "",
    );
  }

  parts.push(
    "B-ROLL PRODUCT SHOT:",
    `Shot ${shotIndex + 1} of ${totalShots} in montage sequence`,
    "",
    "SHOT ACTION:",
    shot.action,
    "",
    "SHOT CONTEXT:",
    `- Shot Type: B-Roll Product Shot`,
    `- Duration: ${shot.durationSeconds} seconds`,
    `- Scene Type: ${sceneData.sceneType}`,
    `- Camera Angle: ${sceneData.cameraAngle}`,
  );

  parts.push(
    "",
    "CRITICAL OUTPUT FORMAT:",
    "- Generate EXACTLY ONE single image, NOT a collage, grid, matrix, or multiple images combined",
    "- The output must be a single photograph-style image",
    "- Do NOT create side-by-side comparisons, before/after layouts, or any multi-panel arrangements",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Photorealistic quality, clean product photography",
    "- Vertical 9:16 aspect ratio for social media",
    "- Professional but authentic aesthetic - NOT overly polished stock imagery",
    "- Product should be clearly visible and the focal point",
    "- Natural or softbox lighting with proper shadows",
    "- Clean, uncluttered composition",
    "",
    "NEGATIVE: blurry, out of focus, watermarks, text overlays, deformed products, unrealistic colors, oversaturated images, collages, grids, multiple images, split images, hands holding product unless specified, human faces unless specified",
  );

  return parts.join("\n");
}

export function buildSceneImagePrompt(
  sceneData: GenerateSceneImageJob["sceneData"],
  hasReferenceImages: boolean,
  hasProductImages: boolean,
  productName?: string,
  userRefinement?: string,
  frameType: FrameType = "start",
  characterAppearance?: CharacterAppearance,
  hasSupportingImages?: boolean,
): string {
  const parts: string[] = [];

  if (hasReferenceImages) {
    const characterDesc = characterAppearance
      ? buildCharacterDescription(characterAppearance)
      : null;
    let refDescription =
      hasProductImages && productName
        ? `Use the character reference image to maintain consistent identity. This must be the EXACT SAME person shown in the reference - same face, same features, same person. Also use the product reference images to accurately depict "${productName}".`
        : "Use the character reference image to maintain consistent identity. This must be the EXACT SAME person shown in the reference - same face, same features, same person.";

    if (characterDesc) {
      refDescription += ` CHARACTER APPEARANCE: ${characterDesc}. CRITICAL: Maintain the same race, skin color, and physical features throughout - do not change the character's ethnicity or appearance.`;
    }

    parts.push(`REFERENCE IMAGES PROVIDED: ${refDescription}`, "");
  }

  if (hasSupportingImages) {
    parts.push(
      `SUPPORTING REFERENCE IMAGES: Use the additional supporting reference images to guide visual style, composition, and scene details. Replicate key elements, layouts, or visual references from these images where appropriate.`,
      "",
    );
  }

  if (hasProductImages && productName) {
    parts.push(
      `PRODUCT FEATURED: "${productName}"`,
      `This scene should prominently feature the product "${productName}" as shown in the reference images. The product must be clearly visible and accurately depicted.`,
      "",
    );
  }

  parts.push(
    "UGC IPHONE AUTHENTICITY STYLE:",
    UGC_IPHONE_STYLE,
    "",
    "SCENE VISUAL DIRECTION:",
    sceneData.cinematicPrompt,
    "",
    "SCENE CONTEXT:",
    `- Scene Type: ${sceneData.sceneType}`,
    `- Camera Angle: ${sceneData.cameraAngle}`,
    `- Emotion: ${sceneData.emotion}`,
    `- Action: ${sceneData.action}`,
  );

  if (frameType === "start") {
    parts.push(
      "",
      "FRAME TIMING: START FRAME",
      "- This is the BEGINNING moment of the scene",
      "- Character is about to begin the action, initial anticipation",
      "- Product/device in starting position",
      "- Expression shows initial emotion before transformation",
    );
  } else {
    parts.push(
      "",
      "FRAME TIMING: END FRAME",
      "- This is the FINAL moment of the scene",
      "- Action has been completed, result is visible",
      "- Product/device in final position after interaction",
      "- Expression shows satisfied/transformed emotion after the action",
      "- Keep the SAME camera angle, framing, and setting as start frame",
    );
  }

  if (userRefinement) {
    parts.push("", `USER NOTES: ${userRefinement}`);
  }

  parts.push(
    "",
    "CRITICAL OUTPUT FORMAT:",
    "- Generate EXACTLY ONE single image, NOT a collage, grid, matrix, or multiple images combined",
    "- The output must be a single photograph-style image as if taken by an iPhone camera",
    "- Do NOT create side-by-side comparisons, before/after layouts, or any multi-panel arrangements",
    "",
    "TECHNICAL REQUIREMENTS:",
    "- Photorealistic quality, indistinguishable from a real iPhone photograph",
    "- UGC/social media authentic aesthetic - NOT professional studio lighting",
    "- Vertical 9:16 aspect ratio for social media",
    "- Natural available light with mixed color temperature (daylight + tungsten)",
    "- Visible skin texture: pores, natural oils, imperfections",
    "- Sensor noise and grain consistent with iPhone in indoor lighting",
    "- Mild lens artifacts: slight vignette, chromatic aberration at edges",
    `- Expression matches emotion: ${sceneData.emotion}`,
    "- Correct human anatomy with natural proportions",
    "- Exactly two arms, exactly two hands with five fingers each",
    "- Natural body positioning and limb placement",
    "",
    "NEGATIVE: extra limbs, extra arms, extra hands, extra fingers, missing limbs, deformed hands, fused fingers, too many fingers, mutated hands, malformed limbs, bad anatomy, distorted body parts, unnatural arm positions, floating limbs, disconnected limbs, cartoon style, illustration, watermarks, text overlays, deformed features, unnatural colors, oversaturated images, collages, grids, multiple images, split images, side-by-side images, matrix layouts, photo grids, studio lighting, professional photography, perfect skin, airbrushed, beauty filter, cinematic lighting, dramatic shadows",
  );

  return parts.join("\n");
}
