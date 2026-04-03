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
    .max(1)
    .optional()
    .describe("For CHARACTER or CHARACTER_AND_PRODUCT shots in multi-character videos: which character (0 or 1) appears. Defaults to scene-level characterIndex if omitted."),
});

export const scriptAgentArollShotSchema = z.object({
  dialogue: z
    .string()
    .describe("What this character says. Every sentence starts with an ElevenLabs emotion tag."),
  action: z
    .string()
    .describe("Physical action. Character faces a microphone, NOT the camera. No eye contact with camera."),
  imageGenPrompt: z
    .string()
    .describe("Self-contained first-frame image prompt for THIS shot. Describe THIS character's appearance (hair, skin, clothing), podcast studio setting, camera angle (side/three-quarter), microphone. Each shot should have a different angle or framing."),
  cinematicPrompt: z
    .string()
    .describe("Camera movement and visual progression for this shot's video generation."),
  characterIndex: z
    .number()
    .min(0)
    .max(1)
    .describe("Which character speaks (0 or 1). Must alternate between consecutive shots."),
  ambientSound: z
    .string()
    .nullable()
    .describe("Per-shot ambient override. Null inherits from scene-level ambientSound."),
  angle: z
    .string()
    .describe("Camera angle and body position for this character. Character A and Character B MUST have different angles (one faces left, other faces right). All shots of the SAME character reuse the SAME angle."),
});

export const scriptAgentSceneSchema = z.object({
  sceneNumber: z.number().describe("Scene number (1-based)"),
  slug: z.string().describe("Short descriptive label (2-4 words)"),
  sceneType: z
    .enum(["a-roll", "a-roll-multi", "b-roll", "visual"])
    .describe("a-roll = actor to camera, a-roll-multi = podcast multi-character conversation (ONLY for podcast videoType), b-roll = product with VO, visual = silent"),
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
    .max(1)
    .optional()
    .describe("Index of the character for this scene (0 or 1). Required for a-roll scenes in multi-character videos. Omit for single-character videos."),
  arollShots: z
    .array(scriptAgentArollShotSchema)
    .min(2)
    .max(6)
    .optional()
    .describe("For podcast a-roll-multi scenes ONLY: 2-6 alternating character shots. Each shot is one character's turn in the conversation. Omit for regular a-roll/b-roll/visual scenes."),
  shots: z
    .array(scriptAgentShotSchema)
    .describe(
      "Shot breakdown for b-roll/visual scenes (1-5 shots). Empty array for a-roll and a-roll-multi scenes.",
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
