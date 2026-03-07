import { ShotType } from "../services/ai-ugc/kling.service";

export interface GroundedCinematicPromptConfig {
  originalCinematicPrompt: string;
  shotType: ShotType;
  emotion: string;
  action: string;
  hasEndImage: boolean;
}

/**
 * Generates the system prompt for creating a Kling 2.6 Pro optimized video prompt.
 *
 * Key principle: Keep it SHORT and SIMPLE.
 * - One subject, one action, one camera move
 * - Image provides the scene — prompt describes MOTION only
 * - Use ++emphasis++ sparingly on critical stability elements
 */
export function generateGroundedCinematicSystemPrompt(
  config: GroundedCinematicPromptConfig
): string {
  const { originalCinematicPrompt, shotType, emotion, action } = config;

  const shotGuidance =
    shotType === "a-roll"
      ? "This is a TALKING HEAD shot. Focus on natural speech: lip movement, subtle expressions, eye contact. Keep the person still except for speaking."
      : "This is a B-ROLL shot. Look at the image and describe the ONE simple motion that naturally follows the ACTION from the creative direction.";

  return `You are a Kling video prompt writer. Write a SHORT, simple motion prompt (under 1500 characters) from the image(s).

CREATIVE DIRECTION: ${originalCinematicPrompt}
ACTION: ${action}
EMOTION: ${emotion}

${shotGuidance}

RULES:
- KEEP IT SHORT. 3-5 sentences max. The image already shows the scene — just describe the motion.
- One subject, one simple action, one camera move (or static). That's it.
- Use ++emphasis++ only on: "++Subject maintains exact appearance throughout++" and "++No morphing or shape changes++"
- End with: "NEGATIVE: morphing, distortion, warping, extra fingers, blurry, text overlays, jerky motion."
- Do NOT over-describe the scene, lighting, colors, or atmosphere — the image handles that.
- Do NOT add product-specific instructions unless the image clearly shows a product being showcased.

Return JSON: { "groundedPrompt": "YOUR_SHORT_PROMPT" }`;
}

/**
 * Generates the user prompt for the grounded cinematic prompt request.
 */
export function generateGroundedCinematicUserPrompt(
  config: GroundedCinematicPromptConfig
): string {
  const { hasEndImage, shotType } = config;

  const imageGuidance = hasEndImage
    ? "Two images: START and END frames. Describe the simple transition between them."
    : "One image. Describe one simple 5-10 second motion for what you see.";

  const shotGuidance = shotType === "a-roll"
    ? "Talking head — focus on natural speech and expressions only."
    : "B-roll — describe what's actually in the image and one simple motion that follows the creative direction.";

  return `${imageGuidance}
${shotGuidance}
Keep it short — 3-5 sentences. Return JSON: { "groundedPrompt": "..." }`;
}

/**
 * Pre-built Kling prompt templates for common UGC scenarios
 */
export const KLING_UGC_TEMPLATES = {
  talkingHead: (subjectDesc: string, emotion: string) =>
    `${subjectDesc}. Natural speaking motion, subtle head movements, ${emotion} expression. ++Subject maintains exact appearance throughout++. NEGATIVE: morphing, distortion, extra fingers, blurry, text overlays.`,

  productShowcase: (productDesc: string) =>
    `${productDesc}. Slow smooth rotation showcasing product, steady hands. ++Product remains solid and unchanged++. NEGATIVE: warping, shape changes, morphing, blurry, jerky motion.`,

  productInteraction: (actorDesc: string, productDesc: string, action: string) =>
    `${actorDesc} with ${productDesc}. ${action} with natural motion. ++Subject and product maintain exact appearance++. NEGATIVE: morphing, distortion, extra fingers, warping, jerky motion.`,

  phoneScreen: (actorDesc: string) =>
    `${actorDesc} holding phone toward camera. ++Phone stays flat and rectangular, screen content frozen++. Steady hold with slight natural micro-movements. NEGATIVE: phone warping, screen changing, morphing, distortion.`,
};
