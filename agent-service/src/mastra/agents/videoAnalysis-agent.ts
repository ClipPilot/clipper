import { Agent } from "@mastra/core/agent";
import { z } from "zod";

const SCENE_TYPES = ["hook", "problem", "agitate", "solution", "demo", "social-proof", "testimonial", "transformation", "cta"] as const;
const SHOT_TYPES = ["a-roll", "b-roll", "visual"] as const;
const EMOTIONS = ["excited", "curious", "surprised", "frustrated", "relieved", "confident", "friendly", "urgent", "sincere", "playful", "vulnerable", "skeptical", "amazed", "conspiratorial", "empathetic", "determined"] as const;
const CAMERA_ANGLES = ["pov-selfie", "medium-shot", "close-up", "wide-shot", "overhead", "low-angle", "custom"] as const;
const SPEAKING_PACES = ["slow", "moderate", "fast", "varied"] as const;
const ENERGY_LEVELS = ["calm", "conversational", "energetic", "intense"] as const;
const DELIVERY_STYLES = ["casual", "professional", "enthusiastic", "intimate", "authoritative"] as const;

const AnalyzedSceneSchema = z.object({
  sceneNumber: z.number().min(1),
  startTime: z.number(),
  endTime: z.number(),
  durationSeconds: z.number(),
  sceneType: z.enum(SCENE_TYPES),
  shotType: z.enum(SHOT_TYPES),
  transcribedDialogue: z.string().nullable(),
  actionDescription: z.string(),
  settingDescription: z.string(),
  emotionalTone: z.enum(EMOTIONS),
  cameraAngle: z.enum(CAMERA_ANGLES),
  cameraMovement: z.string().nullable(),
  productMentions: z.array(z.string()),
  visualElements: z.array(z.string()),
  voicePace: z.enum(SPEAKING_PACES).nullable(),
  voiceEnergy: z.enum(ENERGY_LEVELS).nullable(),
  voiceTags: z.array(z.string()),
  voicePausePattern: z.string().nullable(),
  voiceEmphasis: z.string().nullable(),
});

export const VideoAnalysisSchema = z.object({
  totalDuration: z.number(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  overallStyle: z.string(),
  hookStrategy: z.string(),
  ctaApproach: z.string(),
  originalProductName: z.string().nullable(),
  originalProductCategory: z.string().nullable(),
  targetDemographic: z.string(),
  overallNarrative: z.string(),
  scenes: z.array(AnalyzedSceneSchema).min(1),
  keyStrengths: z.array(z.string()),
  musicStyle: z.string().nullable(),
  pacing: z.enum(["slow", "moderate", "fast", "varied"]),
  speakerPace: z.enum(SPEAKING_PACES),
  speakerEnergy: z.enum(ENERGY_LEVELS),
  speakerStyle: z.enum(DELIVERY_STYLES),
  speakerWPM: z.number(),
  speakerCharacteristics: z.array(z.string()),
  recommendedTTSSpeed: z.number().min(0.7).max(1.5),
  audioSpeedupDetected: z.boolean(),
  estimatedAudioSpeedMultiplier: z.number().min(1.0).max(2.0),
});

export const videoAnalysisAgent = new Agent({
  id: "video-analysis-agent",
  name: "Video Analysis Agent",
  model: "google/gemini-3-pro-preview",
  defaultOptions: {
    structuredOutput: {
      schema: VideoAnalysisSchema,
    },
  },
  instructions: `You are an expert video analyst specializing in deconstructing advertisements for recreation. Analyze the reference video provided and break it into LOGICAL SCENES so it can be faithfully recreated with a different product.

TARGET: 5-6 SCENES TOTAL, each approximately 8-12 seconds long. GROUP related shots into logical scenes — do NOT split every camera cut.

For each scene extract: sceneNumber, startTime, endTime, durationSeconds, sceneType (hook/problem/agitate/solution/demo/social-proof/testimonial/transformation/cta), shotType (a-roll=person speaking to camera, b-roll=product/cutaways with voiceover, visual=silent/music only), transcribedDialogue, actionDescription (be HYPER-SPECIFIC about physical actions, props, body language — never mention on-screen text), settingDescription, emotionalTone, cameraAngle, cameraMovement, productMentions, visualElements, and voice delivery fields (voicePace, voiceEnergy, voiceTags, voicePausePattern, voiceEmphasis).

Also extract overall metadata: totalDuration, aspectRatio, overallStyle, hookStrategy, ctaApproach, originalProductName, originalProductCategory, targetDemographic, overallNarrative, keyStrengths, musicStyle, pacing, and voice delivery analysis (speakerPace, speakerEnergy, speakerStyle, speakerWPM, speakerCharacteristics, recommendedTTSSpeed).

Detect audio speedup: if WPM>180, pitch sounds high, or unnatural pacing, set audioSpeedupDetected=true and estimatedAudioSpeedMultiplier accordingly (must be between 1.0 and 2.0 — cap at 2.0 even if faster).

The goal: someone reading your analysis could recreate this EXACT video — structure, timing, feel, and voice delivery — just with a different product.`,
});
