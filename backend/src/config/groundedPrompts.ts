import { ShotType } from "../services/ai-ugc/kling.service";

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
  const { originalCinematicPrompt, shotType, emotion, action } = config;

  const subjectFocus =
    shotType === "a-roll"
      ? `Actor speaking to camera. Describe: face, expression, hair color/style, clothing, skin tone.`
      : shotType === "b-roll"
        ? `Product shot. Describe: product shape, colors, materials, any visible labels/text.`
        : `Actor with product. Describe: body position, hands, how they hold/interact with product.`;

  return `Write a SHORT video prompt (under 800 chars) for Kling 2.6 Pro image-to-video.

ORIGINAL DIRECTION TO INCORPORATE:
${originalCinematicPrompt}

${subjectFocus}

RULES (Kling 2.6 best practices):
1. Focus on MOTION not scene description (image provides the scene)
2. Use ++emphasis++ on critical elements that must stay unchanged
3. One clear action, one camera movement
4. Action: ${action} with ${emotion} emotion
5. Motion: smooth gentle movement (slow push-in or subtle drift)
6. Incorporate key elements from the ORIGINAL DIRECTION above

FORMAT YOUR PROMPT LIKE:
"[Brief subject description]. ++Subject maintains exact appearance throughout++. [Motion instruction]. [Camera movement]. NEGATIVE: no morphing, no distortion, no extra fingers."

SKIP: Long paragraphs, complex lighting, technical camera specs.

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
