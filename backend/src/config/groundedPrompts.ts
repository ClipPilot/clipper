import { ShotType } from "../services/ai-ugc/kling.service";

export interface GroundedCinematicPromptConfig {
  originalCinematicPrompt: string;
  shotType: ShotType;
  emotion: string;
  action: string;
  hasEndImage: boolean;
}

/**
 * Kling 2.6 Pro Prompt Structure (max 2500 characters):
 *
 * 1. SUBJECT - Main focus of the shot (actor or product)
 * 2. SUBJECT MOVEMENT - Simple, straightforward motion suitable for 5-10 seconds
 * 3. SCENE DESCRIPTION - Brief environmental context (image provides most detail)
 * 4. SUBJECT DESCRIPTION - Key attributes (image should suffice for most detail)
 * 5. CAMERA - Position and any movement
 * 6. LIGHTING & ATMOSPHERE - Mood and tone setters
 *
 * Best Practices:
 * - Use ++emphasis++ for critical elements that must stay unchanged
 * - One subject, one action, one camera movement - keep it simple
 * - Focus on MOTION directives (image provides the scene)
 * - Include rigidity language: "remains solid throughout", "maintains exact appearance"
 * - Aggressive negative prompts to prevent morphing/distortion
 */

const KLING_MOVEMENT_TEMPLATES = {
  subtle: "gentle natural micro-movements, slight breathing motion, minimal head sway",
  speaking: "natural lip movement synced to speech, subtle facial expressions, occasional small head nods",
  presenting: "smooth deliberate hand gestures, confident posture shifts, direct camera engagement",
  product_hold: "steady hands with minimal movement, slight product rotation, stable grip throughout",
  product_demo: "slow deliberate product manipulation, smooth rotation to show features, careful placement",
  emotional: "expressive facial transitions, authentic emotional micro-expressions, natural body language shifts",
};

const KLING_CAMERA_TEMPLATES = {
  static: "locked static camera with micro-movements only for authenticity",
  slow_push: "very slow 2-second push-in toward subject, smooth and deliberate",
  slow_pull: "gentle pull-back revealing more of the scene, steady drift",
  subtle_drift: "barely perceptible lateral drift, handheld selfie authenticity",
  tracking: "smooth tracking following subject movement, professional glide",
};

const KLING_ATMOSPHERE_TEMPLATES = {
  intimate: "warm intimate mood, soft natural light, cozy authentic feel",
  energetic: "bright vibrant atmosphere, clean lighting, upbeat dynamic energy",
  professional: "clean polished look, even professional lighting, confident tone",
  casual: "relaxed casual vibe, natural available light, authentic UGC aesthetic",
  dramatic: "moody atmospheric lighting, deliberate shadows, emotional intensity",
};

/**
 * Generates the system prompt for creating a Kling 2.6 Pro optimized video prompt.
 * Structured for maximum video quality with 2500 character limit.
 */
export function generateGroundedCinematicSystemPrompt(
  config: GroundedCinematicPromptConfig
): string {
  const { originalCinematicPrompt, shotType, emotion, action } = config;

  // Determine subject focus based on shot type
  const subjectGuidance =
    shotType === "a-roll"
      ? `SUBJECT: Actor speaking directly to camera.
SUBJECT DESCRIPTION: Briefly note face, expression, hair, clothing, skin tone from the image.
SUBJECT MOVEMENT: ${KLING_MOVEMENT_TEMPLATES.speaking} - natural talking head motion.`
      : shotType === "b-roll"
        ? `SUBJECT: Product as hero of the shot.
SUBJECT DESCRIPTION: Note product shape, colors, materials, labels from the image.
SUBJECT MOVEMENT: ${KLING_MOVEMENT_TEMPLATES.product_demo} - slow product showcase motion.`
        : `SUBJECT: Actor interacting with product.
SUBJECT DESCRIPTION: Note body position, hand placement, product positioning from the image.
SUBJECT MOVEMENT: ${KLING_MOVEMENT_TEMPLATES.product_hold} - natural interaction motion.`;

  // Select camera and atmosphere based on emotion
  const cameraStyle = emotion === "excited" || emotion === "energetic"
    ? KLING_CAMERA_TEMPLATES.slow_push
    : KLING_CAMERA_TEMPLATES.subtle_drift;

  const atmosphereStyle = emotion === "intimate" || emotion === "sincere"
    ? KLING_ATMOSPHERE_TEMPLATES.intimate
    : emotion === "excited" || emotion === "playful"
      ? KLING_ATMOSPHERE_TEMPLATES.energetic
      : KLING_ATMOSPHERE_TEMPLATES.casual;

  return `You are a Kling 2.6 Pro prompt engineer. Create a structured video prompt (under 2500 characters) from the provided image(s).

ORIGINAL CREATIVE DIRECTION:
${originalCinematicPrompt}

ACTION TO CAPTURE: ${action}
EMOTION: ${emotion}

===== REQUIRED PROMPT STRUCTURE (follow exactly) =====

${subjectGuidance}

SCENE DESCRIPTION: 2-3 sentences max describing the environment visible in the image. Don't overwhelm - the image provides context.

CAMERA: ${cameraStyle}

LIGHTING & ATMOSPHERE: ${atmosphereStyle}

===== KLING 2.6 PRO OPTIMIZATION RULES =====

1. Use ++double plus++ emphasis on elements that MUST stay unchanged:
   - ++Subject maintains exact appearance throughout++
   - ++Product remains solid and rigid++
   - ++Face structure stays consistent++

2. MOTION FOCUS: The image provides the scene - your job is to describe MOVEMENT
   - One clear subject action
   - One camera movement (or static)
   - Simple and achievable in 5-10 seconds

3. STABILITY LANGUAGE (include these phrases):
   - "maintains exact appearance from first frame to last"
   - "no morphing, no shape changes"
   - "consistent proportions throughout"

4. For phones/screens: "screen stays flat, rectangular, frozen content - no screen changes"

5. NEGATIVE PROMPT (always include):
   "NEGATIVE: morphing, distortion, warping, face changing, body morphing, extra fingers, missing fingers, proportion changes, blurry, low quality, text overlays, watermarks, inconsistent appearance, jerky motion."

===== OUTPUT FORMAT =====

Return JSON: { "groundedPrompt": "YOUR_PROMPT_HERE" }

Your prompt must be under 2500 characters and follow this structure:
[Subject] + [Subject Movement] + [Scene] + [Camera] + [Lighting/Atmosphere] + [Stability phrases] + [NEGATIVE]`;
}

/**
 * Generates the user prompt for the grounded cinematic prompt request.
 */
export function generateGroundedCinematicUserPrompt(
  config: GroundedCinematicPromptConfig
): string {
  const { hasEndImage, shotType } = config;

  const imageGuidance = hasEndImage
    ? "Two images provided: START frame and END frame. Describe the transition between them."
    : "Single image provided. Describe the subject and their simple 5-10 second action.";

  const shotGuidance = shotType === "a-roll"
    ? "This is a talking head shot - focus on natural speech movement and expressions."
    : shotType === "b-roll"
      ? "This is a product shot - focus on product visibility and smooth showcase motion."
      : "This is a mixed shot - focus on actor-product interaction.";

  return `${imageGuidance}

${shotGuidance}

Use ++emphasis++ on critical elements. Include stability language. Keep under 2500 characters.

Return JSON: { "groundedPrompt": "..." }`;
}

/**
 * Pre-built Kling prompt templates for common UGC scenarios
 */
export const KLING_UGC_TEMPLATES = {
  talkingHead: (subjectDesc: string, emotion: string) =>
    `${subjectDesc}. ++Subject maintains exact facial features and appearance throughout++. Natural speaking motion with subtle head movements and authentic ${emotion} expression. Lips move naturally, eyes maintain camera contact with occasional natural blinks. ${KLING_CAMERA_TEMPLATES.subtle_drift}. ${KLING_ATMOSPHERE_TEMPLATES.casual}. Smooth 5-second duration. NEGATIVE: morphing, face changing, distortion, extra fingers, blurry, text overlays, inconsistent appearance.`,

  productShowcase: (productDesc: string) =>
    `${productDesc}. ++Product remains solid, rigid, and unchanged throughout - no morphing++. Slow deliberate rotation showcasing product features, smooth 90-degree turn over 5 seconds. Hands hold product steadily with consistent grip. ${KLING_CAMERA_TEMPLATES.slow_push}. ${KLING_ATMOSPHERE_TEMPLATES.professional}. NEGATIVE: product warping, shape changes, label morphing, blurry text, distortion, jerky motion.`,

  productInteraction: (actorDesc: string, productDesc: string, action: string) =>
    `${actorDesc} with ${productDesc}. ++Both actor and product maintain exact appearance throughout++. ${action} with natural fluid motion. Hands interact smoothly with product, consistent grip and positioning. ${KLING_CAMERA_TEMPLATES.subtle_drift}. ${KLING_ATMOSPHERE_TEMPLATES.casual}. NEGATIVE: morphing, face changing, product warping, extra fingers, inconsistent proportions, jerky motion.`,

  phoneScreen: (actorDesc: string) =>
    `${actorDesc} holding phone toward camera. ++Phone remains flat, rectangular, same device throughout - screen content frozen++. Actor holds device steady, showing screen but not using it. Slight natural hand micro-movements for authenticity. ${KLING_CAMERA_TEMPLATES.static}. ${KLING_ATMOSPHERE_TEMPLATES.casual}. NEGATIVE: phone warping, screen changing, bent device, morphing bezels, screen content changing, face morphing.`,
};
