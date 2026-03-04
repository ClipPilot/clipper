import { z } from "zod";

export const SCENE_TYPES = [
  "hook",
  "problem",
  "agitate",
  "solution",
  "demo",
  "social-proof",
  "testimonial",
  "transformation",
  "cta",
] as const;

export const EMOTIONS = [
  "excited",
  "curious",
  "surprised",
  "frustrated",
  "relieved",
  "confident",
  "friendly",
  "urgent",
  "sincere",
  "playful",
  "vulnerable",
  "skeptical",
  "amazed",
  "conspiratorial",
  "empathetic",
  "determined",
] as const;

export const SHOT_TYPES = ["a-roll", "b-roll"] as const;

export const CAMERA_ANGLES = [
  "pov-selfie",
  "medium-shot",
  "close-up",
  "wide-shot",
  "overhead",
  "low-angle",
  "custom",
] as const;

export const B_ROLL_SHOT_TYPES = ["CHARACTER", "PRODUCT", "CHARACTER_AND_PRODUCT"] as const;

export const BRollShotSchema = z.object({
  action: z.string().describe("Simple, single action for this shot. NEVER mention on-screen text, captions, or graphics."),
  cinematicPrompt: z.string().describe("Cinematic prompt for this specific shot. No text/caption mentions."),
  durationSeconds: z.number().min(1).max(4).describe("Duration of this shot (1-4 seconds)"),
  productImageNeeded: z.boolean().describe("Whether this shot should include/show the product. Set to true for product closeups, unboxing, demos. Set to false for lifestyle, mood, reaction, or 'before' shots where product shouldn't appear."),
  shotType: z.enum(B_ROLL_SHOT_TYPES).describe("What this shot features: CHARACTER (person doing an action), PRODUCT (product-only/environment shot), or CHARACTER_AND_PRODUCT (person interacting with the product)."),
});

export const UGCSceneBaseSchema = z.object({
  id: z.string().describe("Unique identifier for the scene"),
  sceneNumber: z.number().min(1).describe("Scene sequence number"),
  sceneType: z
    .enum(SCENE_TYPES)
    .describe("Type of scene in the UGC script structure"),
  action: z
    .string()
    .describe("What the character is physically doing in this scene. NEVER mention on-screen text, captions, titles, or graphics - only describe physical actions and visuals."),
  dialogue: z.string().describe("What the actor says in this scene"),
  emotion: z.enum(EMOTIONS).describe("Emotional delivery style"),
  estimatedDurationSeconds: z
    .number()
    .min(2)
    .max(180)
    .describe("Estimated duration for natural pacing"),
  shotType: z
    .enum(SHOT_TYPES)
    .describe("A-roll (actor talking) or B-roll (product shots)"),
  cameraAngle: z
    .enum(CAMERA_ANGLES)
    .describe("Camera angle/perspective for the shot"),
  cinematicPrompt: z
    .string()
    .describe("Detailed cinematic/video generation prompt. NEVER mention on-screen text, captions, titles, or graphics - only describe visuals and actions."),
  ambientSound: z
    .string()
    .nullable()
    .describe("REQUIRED for a-roll scenes: natural background sound matching the environment (e.g., 'quiet kitchen with fridge hum', 'car interior with road noise', 'outdoor park with birds'). Set to null for b-roll scenes."),
  bRollShots: z
    .array(BRollShotSchema)
    .min(1)
    .max(5)
    .nullable()
    .optional()
    .describe("For B-roll PRODUCT DEMO scenes only: multi-shot sequences for unboxing, product showcases, demos. Do NOT use for person-focused b-roll scenes. Each shot has productImageNeeded to control whether product reference is used."),
  mergedSceneTypes: z
    .array(z.enum(SCENE_TYPES))
    .nullable()
    .optional()
    .describe("Original scene types that were combined for merged scenes"),
});

export const UGCSceneSchema = UGCSceneBaseSchema.refine(
  (scene) => {
    if (scene.shotType === "a-roll") {
      return scene.ambientSound !== null && scene.ambientSound.trim().length > 0;
    }
    return true;
  },
  {
    message: "A-roll scenes MUST have ambientSound (background audio matching the environment)",
    path: ["ambientSound"],
  }
).refine(
  (scene) => {
    if (scene.shotType === "a-roll") {
      return scene.dialogue.trim().length > 0;
    }
    return true;
  },
  {
    message: "A-roll scenes MUST have non-empty dialogue",
    path: ["dialogue"],
  }
);

export const UGCScriptSchema = z.object({
  title: z.string().describe("Catchy title for the UGC ad"),
  hook: z.string().describe("The attention-grabbing opening line"),
  targetAudience: z.string().describe("Who this script is designed for"),
  totalEstimatedDuration: z
    .number()
    .describe("Total estimated duration in seconds"),
  scenes: z
    .array(UGCSceneSchema)
    .min(1)
    .max(8)
    .describe("Array of scenes that make up the script"),
  viralScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Score from 0-100 rating viral potential"),
  viralReasoning: z
    .string()
    .describe("Brief explanation of what makes this script engaging"),
  productMentions: z
    .array(
      z.object({
        sceneId: z.string(),
        productFeature: z.string(),
        visualSuggestion: z.string(),
      })
    )
    .describe("Where and how products are featured"),
});

export const GenerateUGCScriptResponseSchema = z.object({
  scripts: z
    .array(UGCScriptSchema)
    .min(1)
    .max(3)
    .describe("Array of script variations"),
});

export type SceneType = (typeof SCENE_TYPES)[number];
export type Emotion = (typeof EMOTIONS)[number];
export type ShotType = (typeof SHOT_TYPES)[number];
export type CameraAngle = (typeof CAMERA_ANGLES)[number];
export type BRollShot = z.infer<typeof BRollShotSchema>;
export type UGCScene = z.infer<typeof UGCSceneSchema>;
export type UGCScript = z.infer<typeof UGCScriptSchema>;
export type GenerateUGCScriptResponse = z.infer<
  typeof GenerateUGCScriptResponseSchema
>;

export type ClientUGCScene = Omit<UGCScene, "cinematicPrompt">;
export type ClientUGCScript = Omit<UGCScript, "scenes"> & {
  scenes: ClientUGCScene[];
};
