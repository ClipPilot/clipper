import { GenerateSceneImageJob } from "../../services/sqs.service";

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

const ANATOMY_NEGATIVE = [
  "extra limbs", "additional limbs", "three arms", "four arms", "multiple arms",
  "extra hands", "additional hands", "three hands", "four hands", "multiple hands",
  "duplicate hand on same side", "two hands on one arm", "cloned hand next to original",
  "phantom hand beside holding hand", "mirrored hand", "hand shadow duplicate",
  "two left hands", "two right hands", "hands side by side on same arm",
  "extra fingers", "six fingers", "seven fingers", "eight fingers", "missing fingers",
  "fused fingers", "merged fingers", "webbed fingers", "stub fingers",
  "deformed hands", "mutated hands", "malformed hands", "twisted hands", "mangled hands",
  "wrong hand anatomy", "impossible hand position", "backwards hands", "upside down hands",
  "floating hands", "disconnected hands", "hands growing from wrong place",
  "extra legs", "three legs", "four legs", "missing legs",
  "distorted body", "warped anatomy", "impossible pose", "contorted limbs",
  "body horror", "mutation", "deformity", "anatomical error",
].join(", ");

const STYLE_NEGATIVE = [
  "cartoon", "illustration", "drawing", "painting", "anime", "manga",
  "3D render", "CGI", "digital art", "artistic", "stylized",
  "watermark", "signature", "text", "caption", "title", "subtitle", "label",
  "logo", "brand name", "typography", "written words", "speech bubble",
  "collage", "grid", "matrix", "multiple images", "split image", "side-by-side",
  "before after", "comparison", "photo strip", "contact sheet",
  "oversaturated", "HDR", "overprocessed", "artificial colors",
].join(", ");

const IPHONE_CAMERA_SPECS = `Shot on iPhone 15 Pro at 26mm equivalent, f/1.78 aperture. Available light: mixed daylight from window and warm tungsten interior creating natural color temperature shift. ISO 640 producing authentic sensor grain visible in shadow areas. Computational photography engaged but not overdone. Slight barrel distortion at frame edges, natural vignette falloff around 12%. Micro lens smudge creating subtle haze. Vertical 9:16 framing for social media.`;

const SKIN_REALISM = `Skin shows authentic texture: visible pores on nose and cheeks, natural oil shine on T-zone, subtle imperfections including tiny bumps or barely visible blemishes. Color varies naturally across face with slight redness around nose. Fine peach fuzz catches sidelight along jawline. No beauty filter, no skin smoothing, no airbrushing.`;

export function buildCharacterDescription(appearance: CharacterAppearance): string {
  const parts: string[] = [];
  if (appearance.gender) parts.push(appearance.gender);
  if (appearance.ageRange) parts.push(`${appearance.ageRange} years old`);
  if (appearance.skinTone) parts.push(`${appearance.skinTone} skin`);
  if (appearance.hairColor && appearance.hairStyle) {
    parts.push(`${appearance.hairColor} ${appearance.hairStyle} hair`);
  } else if (appearance.hairColor) {
    parts.push(`${appearance.hairColor} hair`);
  }
  if (appearance.eyeColor) parts.push(`${appearance.eyeColor} eyes`);
  if (appearance.bodyType) parts.push(`${appearance.bodyType} build`);
  return parts.join(", ");
}

function buildReferenceImageGuide(imagePositions: ImagePositions): string {
  const lines: string[] = ["REFERENCE IMAGE GUIDE:"];
  let position = 1;

  if (imagePositions.supportingCount > 0) {
    for (let i = 0; i < imagePositions.supportingCount; i++) {
      lines.push(`Image ${position}: USER-UPLOADED REFERENCE - Incorporate this visual content into the scene. Reproduce it faithfully as the focal element.`);
      position++;
    }
  }

  if (imagePositions.hasCharacter) {
    lines.push(`Image ${position}: CHARACTER IDENTITY - Match this person exactly if any human features appear in the shot.`);
    position++;
  }

  if (imagePositions.productCount > 0) {
    for (let i = 0; i < imagePositions.productCount; i++) {
      lines.push(`Image ${position}: PRODUCT REFERENCE - Replicate this product's appearance accurately.`);
      position++;
    }
  }

  return lines.join("\n");
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
  imagePositions?: ImagePositions
): string {
  const sections: string[] = [];

  if (imagePositions?.supportingCount && imagePositions.supportingCount > 0) {
    if (userRefinement) {
      sections.push(`USER INSTRUCTIONS (HIGHEST PRIORITY):
${userRefinement}
When the user says "this" or "the image" or references uploaded content, they are referring to the SUPPORTING REFERENCE IMAGE(S) provided (Image 1${imagePositions.supportingCount > 1 ? ` through Image ${imagePositions.supportingCount}` : ""}). Incorporate that visual content exactly as the user describes.`);
    }

    sections.push(`SUPPORTING REFERENCE IMAGE${imagePositions.supportingCount > 1 ? "S" : ""}:
Image 1${imagePositions.supportingCount > 1 ? ` through Image ${imagePositions.supportingCount}` : ""} ${imagePositions.supportingCount > 1 ? "are user-uploaded references" : "is a user-uploaded reference"}. This is specific visual content the user wants incorporated into the scene. If it shows a screen, app, website, product, or any visual — reproduce that content faithfully and make it the focal element of the shot. The reference image content must be clearly visible and recognizable in the final result.`);
  } else if (userRefinement) {
    sections.push(`USER INSTRUCTIONS (HIGHEST PRIORITY):
${userRefinement}`);
  }

  if (imagePositions && hasReferenceImages) {
    sections.push(buildReferenceImageGuide(imagePositions));
  }

  if (hasReferenceImages && characterAppearance) {
    sections.push(`CHARACTER CONSISTENCY:
If any human features appear (hands, arms, partial body), they must match the character shown in the reference image. Maintain identical skin tone and physical characteristics.`);
  }

  if (productName) {
    sections.push(`FEATURED PRODUCT: "${productName}"
The product must be clearly visible, accurately depicted, and the natural focal point of the composition.`);
  }

  sections.push(`SHOT DESCRIPTION:
B-roll shot ${shotIndex + 1} of ${totalShots} in a montage sequence.

Action: ${shot.action}

Context: ${sceneData.sceneType} scene, ${sceneData.cameraAngle} angle, ${shot.durationSeconds} second duration.`);

  sections.push(`OUTPUT REQUIREMENTS:
Generate exactly ONE photograph. Not a collage, not a grid, not a comparison, not multiple panels. A single cohesive image.

Zero text of any kind. No captions, no labels, no watermarks, no logos, no typography anywhere in the image.

ANATOMY - CRITICAL:
- A human has a MAXIMUM of TWO HANDS and TWO ARMS. Zero, one, or two hands may be visible — NEVER three or more.
- Each ARM ends in exactly ONE HAND. Never show two hands growing from the same arm or two hands side-by-side on the same side of the body.
- If a person holds a product with ONE hand, the OTHER hand must be clearly elsewhere — at their side, behind their back, resting on a surface, or out of frame. Never place a second hand right next to the holding hand.
- Each hand has EXACTLY FIVE FINGERS: one thumb and four fingers. No sixth finger, no missing finger, no fused fingers.
- Hands must be clearly separated from each other — never merged, blended, or overlapping unnaturally.
- All fingers must have natural proportions and natural bending angles. No impossibly long, short, twisted, or boneless fingers.
- Arms connect to shoulders, hands connect to wrists — standard human skeletal structure only.
- Every visible hand MUST be attached to a visible arm. No floating or disembodied hands.

TECHNICAL:
Photorealistic product photography quality. Clean composition with the product as clear focal point. Professional but authentic aesthetic. Natural or softbox lighting with proper shadows. Vertical 9:16 aspect ratio.`);

  sections.push(`NEGATIVE: ${ANATOMY_NEGATIVE}, three hands, hand growing from product, hand emerging from nowhere, phantom hand, disembodied hand, hand without arm, extra arm, third arm, arm from wrong angle, weird fingers, boneless fingers, noodle fingers, ${STYLE_NEGATIVE}, blurry, out of focus, low quality, amateur, stock photo watermark`);

  return sections.join("\n\n");
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
  isConsecutiveAroll?: boolean,
  previousSceneSetting?: string,
  hasVideoFrameReference?: boolean
): string {
  const sections: string[] = [];

  if (isConsecutiveAroll) {
    sections.push(`**CRITICAL - CONSECUTIVE SHOT CONTINUITY**
This is a CONTINUATION of the previous scene. You MUST maintain EXACT visual consistency:
- SAME background, SAME room, SAME environment - not similar, IDENTICAL
- SAME lighting setup, SAME color temperature, SAME shadows
- SAME props, furniture, and objects in frame - nothing added or removed
- SAME camera position and framing
- Character wears the SAME outfit in the SAME position
- Only the character's expression and subtle pose changes${previousSceneSetting ? `\n\nPREVIOUS SCENE ENVIRONMENT: ${previousSceneSetting}` : ""}

The first reference image shows the PREVIOUS FRAME - match its environment EXACTLY. This should look like the next frame in a video, not a new scene.`);
  }

  if (hasVideoFrameReference) {
    sections.push(`**AD CLONE - POSE/COMPOSITION REFERENCE**
The FIRST reference image is a frame from the original video ad. Use it as a COMPOSITION and POSE guide ONLY:
- REPLICATE the body positioning, posture, arm placement, and overall pose
- REPLICATE the camera angle, framing, and distance from subject
- REPLICATE the setting layout, background composition, and lighting direction
- DO NOT copy the person's face or identity — use the CHARACTER reference for that`);
  }

  if (hasReferenceImages) {
    const charDesc = characterAppearance ? buildCharacterDescription(characterAppearance) : null;

    let refText = "REFERENCE IMAGES PROVIDED:\n";
    if (hasVideoFrameReference) {
      refText += "Note: Image 1 is the video frame pose reference (see above). The CHARACTER reference image follows after it.\n";
    }
    refText += "The character reference shows the exact person to depict. This must be the identical individual - same face, same features, same identity throughout. Maintain exact skin tone, ethnicity, and physical features. Do not alter the character's race or appearance.\n";

    if (hasProductImages && productName) {
      refText += `\nPRODUCT: "${productName}" must appear exactly as shown in reference images.`;
    }

    sections.push(refText);
  }

  if (hasSupportingImages) {
    sections.push(`SUPPORTING REFERENCES:
Additional reference images guide visual style, composition, and scene details. Incorporate key elements and layouts from these images where appropriate.`);
  }

  if (hasProductImages && productName) {
    sections.push(`FEATURED PRODUCT: "${productName}"
Prominently feature this product. It must be clearly visible and accurately depicted based on reference images.`);
  }

  sections.push(`VISUAL DIRECTION:
${sceneData.cinematicPrompt}

SCENE CONTEXT:
Type: ${sceneData.sceneType}
Camera: ${sceneData.cameraAngle}
Emotion: ${sceneData.emotion}
Action: ${sceneData.action}`);

  const frameGuidance = frameType === "start"
    ? `FRAME TIMING: START
This captures the beginning moment. The subject is about to begin the action. Initial anticipation visible in expression. Product or device in starting position. Emotion shows the "before" state.`
    : `FRAME TIMING: END
This captures the completion moment. Action has finished, result is visible. Product or device in final position after interaction. Expression shows satisfaction or transformation. Maintain identical camera angle and framing from start frame.`;

  sections.push(frameGuidance);

  if (userRefinement) {
    sections.push(`USER NOTES: ${userRefinement}`);
  }

  sections.push(`CAMERA AND AUTHENTICITY:
${IPHONE_CAMERA_SPECS}

${SKIN_REALISM}

This photograph is indistinguishable from a real iPhone capture. Raw UGC social media aesthetic, not a polished studio portrait.`);

  sections.push(`OUTPUT REQUIREMENTS:
Generate exactly ONE photograph. Not a collage, grid, comparison, or multi-panel layout. A single image as if captured on an iPhone.

Zero text anywhere. No captions, titles, labels, watermarks, logos, speech bubbles, or any typography.

ANATOMY - CRITICAL:
The subject has exactly two arms naturally positioned at their sides or engaged in the action. Each arm ends in exactly one hand — never two hands on the same arm or side. If hands are visible, exactly two hands with five fingers each. If one hand holds a product, the other hand must be clearly in a different position (at their side, gesturing, resting elsewhere) — never adjacent to the holding hand. Fingers are in natural positions - no impossible bends, no extra digits, no missing digits, no fused fingers. All limbs connect naturally to the body with standard human proportions.

Expression matches the ${sceneData.emotion} emotion specified.`);

  sections.push(`NEGATIVE: ${ANATOMY_NEGATIVE}, ${STYLE_NEGATIVE}, studio lighting, professional photography, perfect skin, airbrushed, beauty filter, cinematic lighting, dramatic shadows, posed model aesthetic`);

  return sections.join("\n\n");
}
