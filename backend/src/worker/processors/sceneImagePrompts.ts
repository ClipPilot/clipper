import { GenerateSceneImageJob } from "../../services/sqs.service";

export type FrameType = "start" | "end";

export interface BRollShotData {
  action: string;
  cinematicPrompt: string;
  durationSeconds: number;
  productImageNeeded: boolean;
  shotType?: "CHARACTER" | "PRODUCT" | "CHARACTER_AND_PRODUCT";
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
  hasExistingScene?: boolean;
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

// Words that look like proper names (capitalized, 3+ chars) but aren't character names
const PROPER_NAME_BLOCKLIST = new Set([
  "shot", "scene", "camera", "angle", "frame", "close", "wide", "medium",
  "full", "extreme", "dutch", "overhead", "low", "high", "pan", "tilt",
  "table", "desk", "counter", "shelf", "floor", "wall", "door", "window",
  "room", "kitchen", "bathroom", "bedroom", "living", "office", "studio",
  "garden", "park", "street", "beach", "gym", "cafe", "restaurant",
  "marble", "wood", "glass", "metal", "stone", "fabric", "leather",
  "concrete", "tile", "brick", "velvet", "silk", "linen",
  "morning", "evening", "night", "day", "golden", "hour", "sunset",
  "sunrise", "noon", "dusk", "dawn",
  "beauty", "lifestyle", "fashion", "fitness", "health", "luxury",
  "modern", "vintage", "minimal", "elegant", "clean", "natural",
  "red", "blue", "green", "white", "black", "yellow", "pink",
  "purple", "orange", "brown", "gray", "grey", "beige", "ivory",
  "background", "foreground", "left", "right", "center", "front",
  "back", "top", "bottom", "side", "middle", "corner",
  "the", "this", "that", "with", "from", "into", "onto", "upon",
  "over", "under", "about", "after", "before", "during", "between",
  "through", "above", "below", "near", "behind", "beside", "against",
  "toward", "around", "along", "across", "beyond", "inside", "outside",
  "product", "bottle", "serum", "cream", "jar", "tube", "box",
  "package", "container", "lotion", "spray", "dropper",
  "soft", "warm", "cool", "bright", "dark", "dim", "new", "old",
  "big", "small", "large", "tiny", "huge", "long", "short", "tall",
  "vertical", "horizontal", "straight", "tilted",
  "sitting", "standing", "walking", "running", "holding",
  "using", "applying", "showing", "demonstrating", "facing",
  "hook", "problem", "solution", "demo", "testimonial", "transformation",
]);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceCharacterNames(action: string, characterName?: string): string {
  let result = action;

  if (characterName) {
    const nameRegex = new RegExp(`\\b${escapeRegex(characterName)}\\b`, "gi");
    result = result.replace(nameRegex, "the character");
  }

  result = result.replace(/\b[A-Z][a-z]{2,}\b/g, (match) => {
    if (PROPER_NAME_BLOCKLIST.has(match.toLowerCase())) return match;
    return "the character";
  });

  return result;
}

function inferFraming(action: string): string {
  const lower = action.toLowerCase();
  if (/\b(full.?body|head.?to.?toe|stands?\s+tall|walking|striding|full.?length)\b/.test(lower)) {
    return "Full-body shot";
  }
  if (/\b(close.?up|face|eyes?|lips?|detail|macro)\b/.test(lower)) {
    return "Close-up shot";
  }
  if (/\b(hands?|fingers?|wrist|applying|gripping)\b/.test(lower)) {
    return "Close-up on hands/action";
  }
  return "Waist-up shot";
}

function extractSettingAndLighting(cinematicPrompt: string): { setting: string; lighting: string } {
  if (!cinematicPrompt || cinematicPrompt.trim() === "") {
    return { setting: "Neutral environment", lighting: "Natural, soft lighting" };
  }

  const lightingMatch = cinematicPrompt.match(
    /\b(light(?:ing|ed)?|lit|glow|shadow|sun|golden|warm|cool|neon|ambient|soft|harsh|backlit|sidelit|overcast|studio|natural light)[^.]*\.?/i
  );

  if (lightingMatch) {
    const lighting = lightingMatch[0].trim();
    const setting = cinematicPrompt.replace(lightingMatch[0], "").trim() || cinematicPrompt;
    return { setting, lighting };
  }

  return { setting: cinematicPrompt, lighting: "Natural, soft lighting" };
}

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

/**
 * Extract names from user refinement text to associate with the character.
 * Looks for patterns like "make Sarah look...", "have John...", "tell Alex to..."
 * Returns the first capitalized name found, or null.
 */
function extractCharacterNameFromRefinement(userRefinement?: string): string | null {
  if (!userRefinement) return null;
  // Match capitalized words that look like names (not at sentence start after period)
  const namePatterns = [
    /\b(?:make|have|tell|let|show|give)\s+([A-Z][a-z]{2,})\b/,
    /\b([A-Z][a-z]{2,})\s+(?:should|looks?|needs?|is|has|can)\b/,
    /\b(?:for|about|of)\s+([A-Z][a-z]{2,})\b/,
  ];
  for (const pattern of namePatterns) {
    const match = userRefinement.match(pattern);
    if (match) return match[1];
  }
  return null;
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
  characterName?: string
): string {
  // shotType is classified by the LLM at generation time; default to CHARACTER for legacy data
  const shotType = shot.shotType ?? "CHARACTER";

  const cleanAction = replaceCharacterNames(shot.action, characterName);
  const sections: string[] = [];

  // Shot type header
  sections.push(`SHOT TYPE: ${shotType === "CHARACTER_AND_PRODUCT" ? "CHARACTER + PRODUCT" : shotType}`);

  // Reference image guide (dynamic based on actual image positions)
  if (imagePositions && hasReferenceImages) {
    const guideLines: string[] = ["REFERENCE IMAGE GUIDE:"];
    let position = 1;

    if (imagePositions.supportingCount > 0) {
      for (let i = 0; i < imagePositions.supportingCount; i++) {
        guideLines.push(`Image ${position}: USER-UPLOADED REFERENCE — Incorporate this visual content into the scene.`);
        position++;
      }
    }

    if (imagePositions.hasCharacter) {
      guideLines.push(`Image ${position}: CHARACTER IDENTITY — Match this person's face, skin tone, body type, and physical features exactly.`);
      position++;
    }

    if (imagePositions.productCount > 0) {
      for (let i = 0; i < imagePositions.productCount; i++) {
        guideLines.push(`Image ${position}: PRODUCT REFERENCE — Replicate this product's appearance accurately.`);
        position++;
      }
    }

    sections.push(guideLines.join("\n"));
  }

  // Character section (for CHARACTER and CHARACTER_AND_PRODUCT)
  if (shotType === "CHARACTER" || shotType === "CHARACTER_AND_PRODUCT") {
    const framing = inferFraming(cleanAction);

    sections.push(`CHARACTER ACTION:\n"${cleanAction}"\n\nFRAMING:\n${framing}\nCompose as the STARTING POSITION for a ${shot.durationSeconds}-second video. Leave visual room for the motion to unfold naturally.`);
  }

  // Product section (for PRODUCT and CHARACTER_AND_PRODUCT)
  if (shotType === "PRODUCT" || shotType === "CHARACTER_AND_PRODUCT") {
    const productDesc = productName ? `"${productName}"` : "the featured product";

    if (shotType === "PRODUCT") {
      sections.push(`PRODUCT FOCUS:\n${productDesc}\n\nARRANGEMENT:\nCompose as the STARTING POSITION for a ${shot.durationSeconds}-second video where the following action plays out:\n"${cleanAction}"`);
    } else {
      sections.push(`PRODUCT FOCUS:\n${productDesc} — must be clearly visible and accurately depicted.`);
    }
  }

  // Context / Setting / Lighting / Camera
  const { setting, lighting } = extractSettingAndLighting(shot.cinematicPrompt);
  sections.push(`CONTEXT: ${sceneData.sceneType} scene, B-roll shot ${shotIndex + 1} of ${totalShots}.\nSETTING: ${setting}\nLIGHTING: ${lighting}\nCAMERA: Natural angle — straight-on, slight overhead, or tabletop level.\nASPECT RATIO: 9:16 vertical`);

  // User instructions
  if (userRefinement) {
    if (imagePositions?.supportingCount && imagePositions.supportingCount > 0) {
      sections.push(`USER INSTRUCTIONS:\n${userRefinement}\nWhen the user says "this" or "the image", they refer to the USER-UPLOADED REFERENCE image(s).`);
    } else {
      sections.push(`USER INSTRUCTIONS:\n${userRefinement}`);
    }
  }

  // Output rules
  sections.push(`OUTPUT RULES:\n- Exactly ONE photorealistic photograph. No collage, grid, or multi-panel layout.\n- Zero text, captions, labels, watermarks, logos, or typography.`);

  // Negative (varies by shot type)
  const baseNegative = `${STYLE_NEGATIVE}, blurry, out of focus, low quality`;
  if (shotType === "PRODUCT") {
    sections.push(`NEGATIVE: ${baseNegative}, hands, fingers, arms, person, human, body parts`);
  } else {
    sections.push(`NEGATIVE: ${baseNegative}, ${ANATOMY_NEGATIVE}`);
  }

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
  hasVideoFrameReference?: boolean,
  hasExistingScene?: boolean,
): string {
  const sections: string[] = [];

  const isPodcastScene = sceneData.shotType === "a-roll-multi";

  if (isConsecutiveAroll) {
    sections.push(`**CRITICAL - CONSECUTIVE SHOT CONTINUITY**
This is a CONTINUATION of the previous scene. You MUST maintain EXACT visual consistency:
- SAME background, SAME room, SAME environment - not similar, IDENTICAL
- SAME lighting setup, SAME color temperature, SAME shadows
- SAME props, furniture, and objects in frame - nothing added or removed
- SAME camera position and framing
- Character wears the SAME outfit — identical clothing, accessories, hairstyle
- Only the character's expression and subtle pose changes${previousSceneSetting ? `\n\nPREVIOUS SCENE ENVIRONMENT: ${previousSceneSetting}` : ""}

The first reference image shows the PREVIOUS FRAME - match its environment EXACTLY. This should look like the next frame in a video, not a new scene.`);
  }

  if (isPodcastScene) {
    sections.push(`**PODCAST SCENE - STRICT RULES**
- EXACTLY ONE person in frame. NEVER show two people, silhouettes, reflections, or shadows of a second person.
- Character sits at a podcast desk speaking into a microphone. They face the microphone or the other host — NEVER the camera. No eye contact with the camera.
- Character wears the EXACT same outfit shown in the character reference image. Do not change, add, or remove any clothing or accessories.
- The setting is a podcast studio: desk, microphone, headphones, soft studio lighting. This setting MUST be IDENTICAL across all shots in this scene.
- Each character has their OWN camera side and general angle. Character A and Character B are viewed from DIFFERENT sides. Between shots of the SAME character, introduce natural micro-variations in pose — slightly different head tilt, lean, or hand placement — like real podcast footage. Outfit, setting, and camera side remain consistent.`);
  }

  if (hasVideoFrameReference) {
    sections.push(`**AD CLONE - POSE/COMPOSITION REFERENCE**
The FIRST reference image is a frame from the original video ad. Use it as a COMPOSITION and POSE guide ONLY:
- REPLICATE the body positioning, posture, arm placement, and overall pose
- REPLICATE the camera angle, framing, and distance from subject
- REPLICATE the setting layout, background composition, and lighting direction
- DO NOT copy the person's face or identity — use the CHARACTER reference for that`);
  }

  if (hasExistingScene) {
    sections.push(`**REGENERATION - PREVIOUS IMAGE REFERENCE**
One of the reference images shows the PREVIOUS generation of this scene. Use it as a baseline:
- Maintain the same general composition, environment, and framing unless the user explicitly asks for changes
- Apply the user's refinement notes as targeted tweaks to this existing image
- Keep elements that work well, only change what the user requested`);
  }

  if (hasReferenceImages) {
    const charDesc = characterAppearance ? buildCharacterDescription(characterAppearance) : null;
    const characterName = extractCharacterNameFromRefinement(userRefinement);

    let refText = "REFERENCE IMAGES PROVIDED:\n";
    if (hasVideoFrameReference) {
      refText += "Note: Image 1 is the video frame pose reference (see above). The CHARACTER reference image follows after it.\n";
    }
    if (hasExistingScene) {
      refText += "Note: One reference image is the previous generation of this scene (see REGENERATION section above).\n";
    }
    refText += "The character reference shows the exact person to depict. This must be the identical individual - same face, same features, same identity throughout. Maintain exact skin tone, ethnicity, and physical features. Do not alter the character's race or appearance.";
    if (characterName) {
      refText += ` Any mention of "${characterName}" in the user's instructions refers to this character.`;
    }
    refText += "\n";

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
Action: ${sceneData.action}

CAMERA ANGLE - CRITICAL:
Use a natural, realistic camera angle that a real person would capture on their phone. Avoid extreme angles (extreme low-angle, extreme overhead, tilted/dutch angle, fish-eye distortion). The framing should feel like genuine UGC content — straight-on, slight selfie angle, or natural eye-level. No dramatic cinematographic angles.`);

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

  sections.push(`NEGATIVE: ${ANATOMY_NEGATIVE}, ${STYLE_NEGATIVE}, studio lighting, professional photography, perfect skin, airbrushed, beauty filter, cinematic lighting, dramatic shadows, posed model aesthetic, extreme low angle, extreme high angle, dutch angle, tilted camera, fish-eye, wide-angle distortion, dramatic camera angle`);

  return sections.join("\n\n");
}
