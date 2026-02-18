import { z } from "zod";
import { SHOT_TYPES, EMOTIONS, CAMERA_ANGLES, SCENE_TYPES } from "./ugcScript.types";

// Voice delivery constants for analysis
export const SPEAKING_PACES = ["slow", "moderate", "fast", "varied"] as const;
export const ENERGY_LEVELS = ["calm", "conversational", "energetic", "intense"] as const;
export const DELIVERY_STYLES = ["casual", "professional", "enthusiastic", "intimate", "authoritative"] as const;

// Flattened scene schema to avoid Gemini nesting depth limits
export const AnalyzedSceneSchema = z.object({
  sceneNumber: z.number().min(1).describe("Scene sequence number"),
  startTime: z.number().describe("Start time in seconds"),
  endTime: z.number().describe("End time in seconds"),
  durationSeconds: z.number().describe("Scene duration in seconds"),
  sceneType: z.enum(SCENE_TYPES).describe("Inferred scene type (hook, problem, solution, demo, testimonial, cta)"),
  shotType: z.enum(SHOT_TYPES).describe("Whether this is A-roll (person talking), B-roll (product/cutaway), or mixed"),
  transcribedDialogue: z.string().nullable().describe("Transcribed speech in this scene, null if no speech"),
  actionDescription: z.string().describe("What is happening visually in this scene"),
  settingDescription: z.string().describe("Description of the environment/location"),
  emotionalTone: z.enum(EMOTIONS).describe("The emotional tone conveyed"),
  cameraAngle: z.enum(CAMERA_ANGLES).describe("Camera angle used in this scene"),
  cameraMovement: z.string().nullable().describe("Any camera movement (pan, zoom, static, etc.)"),
  productMentions: z.array(z.string()).describe("Any products mentioned or shown"),
  visualElements: z.array(z.string()).describe("Key visual elements (text overlays, graphics, props)"),
  // Flattened voice delivery fields (null if no speech in scene)
  voicePace: z.enum(SPEAKING_PACES).nullable().describe("Speaking pace in this scene (null if no speech)"),
  voiceEnergy: z.enum(ENERGY_LEVELS).nullable().describe("Energy level of delivery (null if no speech)"),
  voiceTags: z.array(z.string()).describe("ElevenLabs audio tags for this scene (e.g., 'excited', 'whispers', 'fast-paced')"),
  voicePausePattern: z.string().nullable().describe("Notable pausing patterns (null if no speech or nothing notable)"),
  voiceEmphasis: z.string().nullable().describe("Words or phrases that are emphasized (null if nothing notable)"),
});

// Flattened video analysis schema
export const VideoAnalysisSchema = z.object({
  totalDuration: z.number().describe("Total video duration in seconds"),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).describe("Video aspect ratio"),
  overallStyle: z.string().describe("Overall style description (UGC, professional, cinematic, etc.)"),
  hookStrategy: z.string().describe("How the video hooks the viewer in the first few seconds"),
  ctaApproach: z.string().describe("How the video handles the call-to-action"),
  originalProductName: z.string().nullable().describe("The product being advertised, if identifiable"),
  originalProductCategory: z.string().nullable().describe("Category of product (skincare, tech, food, etc.)"),
  targetDemographic: z.string().describe("Inferred target audience"),
  overallNarrative: z.string().describe("Summary of the ad's narrative arc"),
  scenes: z.array(AnalyzedSceneSchema).min(1).describe("Scene-by-scene breakdown"),
  keyStrengths: z.array(z.string()).describe("What makes this ad effective"),
  musicStyle: z.string().nullable().describe("Description of background music if present"),
  pacing: z.enum(["slow", "moderate", "fast", "varied"]).describe("Overall pacing of the video"),
  // Flattened voice delivery analysis fields
  speakerPace: z.enum(SPEAKING_PACES).describe("Overall speaking pace throughout the video"),
  speakerEnergy: z.enum(ENERGY_LEVELS).describe("Overall energy level of the speaker"),
  speakerStyle: z.enum(DELIVERY_STYLES).describe("Overall delivery style/personality"),
  speakerWPM: z.number().describe("Estimated words per minute of the speaker"),
  speakerCharacteristics: z.array(z.string()).describe("Notable voice characteristics (e.g., 'uses filler words', 'upward inflection')"),
  recommendedTTSSpeed: z.number().min(0.7).max(1.5).describe("Recommended ElevenLabs speed multiplier (0.7-1.5)"),
  audioSpeedupDetected: z.boolean().describe("Whether the audio appears to be artificially sped up (pitch shift, unnatural pace, >200 WPM)"),
  estimatedAudioSpeedMultiplier: z.number().min(1.0).max(2.0).describe("Estimated speed multiplier applied to original audio (1.0 = normal, 1.25 = 25% faster, 1.5 = 50% faster). Only >1.0 if audioSpeedupDetected is true."),
});

export type AnalyzedScene = z.infer<typeof AnalyzedSceneSchema>;
export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;

// Helper type for backward compatibility
export interface VoiceDeliveryAnalysis {
  overallPace: typeof SPEAKING_PACES[number];
  overallEnergy: typeof ENERGY_LEVELS[number];
  deliveryStyle: typeof DELIVERY_STYLES[number];
  estimatedWPM: number;
  notableCharacteristics: string[];
  recommendedTTSSpeed: number;
}

export type AdCloneProjectStatus =
  | "uploading"
  | "analyzing"
  | "analysis_complete"
  | "generating_script"
  | "script_generated"
  | "generating_video"
  | "completed"
  | "failed";

export interface AdCloneProject {
  id: string;
  teamId: number;
  userId: number;
  referenceVideoKey: string | null;
  productImageKeys: string[];
  productName: string | null;
  productDescription: string | null;
  adDirection: string | null;
  geminiFileName: string | null;
  geminiFileUri: string | null;
  videoAnalysis: VideoAnalysis | null;
  adaptedScripts: import("./ugcScript.types").UGCScript[] | null;
  selectedVariantIndex: number;
  characterId: number | null;
  voiceId: string | null;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string | null;
  errorMessage: string | null;
  finalVideoKey: string | null;
  videoJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdCloneProjectInput {
  teamId: number;
  userId: number;
  productImageKeys: string[];
  productName?: string;
  productDescription?: string;
  adDirection?: string;
}

export interface AdCloneAnalysisResult {
  projectId: string;
  analysis: VideoAnalysis;
  status: "analysis_complete";
}

export interface AdCloneScriptResult {
  projectId: string;
  scripts: import("./ugcScript.types").UGCScript[];
  status: "script_generated";
}
