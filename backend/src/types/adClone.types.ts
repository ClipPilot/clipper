import { z } from "zod";
import { SHOT_TYPES, EMOTIONS, CAMERA_ANGLES, SCENE_TYPES } from "./ugcScript.types";

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
});

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
});

export type AnalyzedScene = z.infer<typeof AnalyzedSceneSchema>;
export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;

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
