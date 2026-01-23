import { z } from "zod";

export const SCENE_TYPES = [
  "hook",
  "problem",
  "solution",
  "demo",
  "testimonial",
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

export const BRollShotSchema = z.object({
  action: z.string().describe("Simple, single action for this shot. NEVER mention on-screen text, captions, or graphics."),
  cinematicPrompt: z.string().describe("Cinematic prompt for this specific shot. No text/caption mentions."),
  durationSeconds: z.number().min(1).max(4).describe("Duration of this shot (1-4 seconds)"),
  productImageNeeded: z.boolean().describe("Whether this shot should include/show the product. Set to true for product closeups, unboxing, demos. Set to false for lifestyle, mood, reaction, or 'before' shots where product shouldn't appear."),
});

export const UGCSceneSchema = z.object({
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
    .max(30)
    .describe("Estimated duration for natural pacing"),
  shotType: z
    .enum(SHOT_TYPES)
    .describe("A-roll (actor talking) or B-roll (product shots)"),
  cameraAngle: z
    .enum(CAMERA_ANGLES)
    .describe("Camera angle/perspective for the shot"),
  customCameraAngle: z
    .string()
    .nullable()
    .describe("Custom camera angle description when cameraAngle is 'custom'"),
  cinematicPrompt: z
    .string()
    .describe("Detailed cinematic/video generation prompt. NEVER mention on-screen text, captions, titles, or graphics - only describe visuals and actions."),
  cameraDirection: z
    .string()
    .nullable()
    .describe("Camera movement suggestions"),
  ambientSound: z
    .string()
    .nullable()
    .describe("REQUIRED for a-roll scenes ONLY: short natural background sound (5-15 words). Examples: 'quiet room tone with subtle air conditioning hum', 'soft indoor ambience with distant muffled sounds'. NO music, NO dramatic sounds, NO production elements. Set to null for b-roll scenes."),
  bRollShots: z
    .array(BRollShotSchema)
    .min(1)
    .nullable()
    .optional()
    .describe("For B-roll PRODUCT DEMO scenes only: multi-shot sequences for unboxing, product showcases, demos. Do NOT use for person-focused b-roll scenes. Each shot has productImageNeeded to control whether product reference is used."),
});

export const UGCScriptSchema = z.object({
  title: z.string().describe("Catchy title for the UGC ad"),
  hook: z.string().describe("The attention-grabbing opening line"),
  targetAudience: z.string().describe("Who this script is designed for"),
  totalEstimatedDuration: z
    .number()
    .describe("Total estimated duration in seconds"),
  scenes: z
    .array(UGCSceneSchema)
    .min(3)
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

export type ClientUGCScene = Omit<UGCScene, "cinematicPrompt" | "cameraDirection">;
export type ClientUGCScript = Omit<UGCScript, "scenes"> & {
  scenes: ClientUGCScene[];
};
