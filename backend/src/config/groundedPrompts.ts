import { ShotType } from "../services/kling.service";

export interface GroundedCinematicPromptConfig {
  originalCinematicPrompt: string;
  shotType: ShotType;
  emotion: string;
  action: string;
  hasEndImage: boolean;
}

/**
 * Generates the system prompt for creating a grounded cinematic prompt.
 * This prompt instructs the AI to analyze the actual generated images
 * and create a new video prompt that matches what the images ACTUALLY show.
 */
export function generateGroundedCinematicSystemPrompt(
  config: GroundedCinematicPromptConfig
): string {
  const { shotType, emotion, action } = config;

  const subjectFocus =
    shotType === "a-roll"
      ? `Actor speaking to camera. Describe: face, expression, hair color/style, clothing, skin tone.`
      : shotType === "b-roll"
        ? `Product shot. Describe: product shape, colors, materials, any visible labels/text.`
        : `Actor with product. Describe: body position, hands, how they hold/interact with product.`;

  return `Write a SHORT video prompt (under 800 chars) for Kling 2.6 describing the image.

${subjectFocus}

FOCUS ON:
1. Subject appearance exactly as shown (what to KEEP UNCHANGED)
2. Action: ${action} with ${emotion} emotion
3. Gentle motion (slow camera push-in, subtle movements)

SKIP: Long background descriptions, lighting details, technical camera specs.

END WITH: "NEGATIVE: no distortion, no morphing, subject maintains exact appearance throughout."

OUTPUT: { "groundedPrompt": "..." } - Keep under 800 characters.`;
}

/**
 * Generates the user prompt for the grounded cinematic prompt request.
 */
export function generateGroundedCinematicUserPrompt(
  config: GroundedCinematicPromptConfig
): string {
  const { hasEndImage } = config;

  return `${hasEndImage ? "Two images: describe subject in both and transition." : "Describe the subject and their action."} Keep under 800 chars. Return JSON: { "groundedPrompt": "..." }`;
}
