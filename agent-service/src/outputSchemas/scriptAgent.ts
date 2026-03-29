import { z } from "zod";

export const scriptAgentShotSchema = z.object({
  label: z
    .string()
    .describe("Brief description of this shot (3-8 words, e.g. 'Close-up of product texture')"),
  shotType: z
    .enum(["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"])
    .describe("What appears in the shot"),
  action: z
    .string()
    .describe("Physical action description for this shot — what happens visually"),
  imageGenPrompt: z
    .string()
    .describe(
      "Self-contained first-frame image generation prompt describing composition, lighting, subject, and environment",
    ),
  cinematicPrompt: z
    .string()
    .describe("Camera movement, visual progression, and timing for video generation"),
  durationSeconds: z.number().describe("Duration of this shot in seconds"),
  productImageNeeded: z
    .boolean()
    .describe("Whether this shot requires a product reference image"),
  characterIndex: z
    .number()
    .min(0)
    .max(3)
    .optional()
    .describe("For CHARACTER or CHARACTER_AND_PRODUCT shots in multi-character videos: which character (by index) appears. Defaults to scene-level characterIndex if omitted."),
});

export const scriptAgentSceneSchema = z.object({
  sceneNumber: z.number().describe("Scene number (1-based)"),
  slug: z.string().describe("Short descriptive label (2-4 words)"),
  sceneType: z
    .enum(["a-roll", "b-roll", "visual"])
    .describe("a-roll = actor to camera, b-roll = product with VO, visual = silent"),
  storyBeat: z
    .string()
    .describe("Narrative purpose (hook, problem, agitate, solution, demo, social-proof, testimonial, transformation, cta, or custom)"),
  dialogue: z
    .string()
    .describe(
      "Dialogue with ElevenLabs emotion tags (e.g. '[excited] Oh my god!'). EVERY sentence starts with a tag. Empty string for silent scenes.",
    ),
  isSilent: z.boolean().describe("Whether this scene has no dialogue"),
  duration: z.number().describe("Estimated duration in seconds"),
  action: z
    .string()
    .describe("Physical action description — what the actor/camera does. No text overlay mentions."),
  imageGenPrompt: z
    .string()
    .describe(
      "Self-contained first-frame image generation prompt. Include character appearance when present.",
    ),
  cinematicPrompt: z
    .string()
    .describe("Camera movement and visual progression for video generation"),
  ambientSound: z
    .string()
    .nullable()
    .describe(
      "REQUIRED for a-roll scenes: detailed background audio description matching the environment (e.g. 'Recorded through iPhone mic — clear voice with slight room echo. Faint air conditioning hum.'). Set to null for b-roll/visual scenes.",
    ),
  characterIndex: z
    .number()
    .min(0)
    .max(3)
    .optional()
    .describe("Index of the character for this scene (0-based). Required for a-roll scenes in multi-character videos. Omit for single-character videos."),
  shots: z
    .array(scriptAgentShotSchema)
    .describe(
      "Shot breakdown for b-roll/visual scenes (1-5 shots). Empty array for a-roll scenes.",
    ),
});

export const scriptAgentSchema = z.object({
  title: z.string().describe("Script title (concise, descriptive)"),
  targetAudience: z
    .string()
    .describe("1-2 sentence description of the ideal viewer"),
  totalDuration: z.number().describe("Total estimated duration in seconds"),
  scenes: z.array(scriptAgentSceneSchema).describe("Ordered array of scenes"),
});
