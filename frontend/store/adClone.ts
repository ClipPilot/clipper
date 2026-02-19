"use client";

import { atom } from "jotai";

export interface AdCloneVideo {
  file: File;
  preview: string;
  duration: number;
}

export interface AdCloneProduct {
  file: File;
  preview: string;
}

export type AdCloneStep =
  | "upload"
  | "storyboard"
  | "character"
  | "generate";

export type AdCloneProjectStatus =
  | "uploading"
  | "analyzing"
  | "analysis_complete"
  | "generating_script"
  | "script_generated"
  | "generating_video"
  | "completed"
  | "failed";

export const RESUMABLE_STATUSES: AdCloneProjectStatus[] = [
  "uploading",
  "analyzing",
  "analysis_complete",
  "generating_script",
  "script_generated",
  "failed",
];

export interface AnalyzedScene {
  sceneNumber: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  sceneType: string;
  shotType: string;
  transcribedDialogue: string | null;
  actionDescription: string;
  settingDescription: string;
  emotionalTone: string;
  cameraAngle: string;
  cameraMovement: string | null;
  productMentions: string[];
  visualElements: string[];
}

export interface VideoAnalysis {
  totalDuration: number;
  aspectRatio: string;
  overallStyle: string;
  hookStrategy: string;
  ctaApproach: string;
  originalProductName: string | null;
  originalProductCategory: string | null;
  targetDemographic: string;
  overallNarrative: string;
  scenes: AnalyzedScene[];
  keyStrengths: string[];
  musicStyle: string | null;
  pacing: string;
}

export interface AdCloneProjectData {
  id: string;
  teamId: number;
  productName: string | null;
  productDescription: string | null;
  adDirection: string | null;
  status: AdCloneProjectStatus;
  progress: number;
  progressMessage: string | null;
  characterId: number | null;
  voiceId: string | null;
  selectedVariantIndex: number;
  referenceVideoUrl?: string;
  productImageUrls?: string[];
  finalVideoUrl?: string;
}

export const adCloneVideoAtom = atom<AdCloneVideo | null>(null);
export const adCloneProductImageAtom = atom<AdCloneProduct | null>(null);
export const adCloneProductNameAtom = atom("");
export const adCloneProductDescriptionAtom = atom("");
export const adCloneAdDirectionAtom = atom("");

export const adCloneProjectIdAtom = atom<string | null>(null);
export const adCloneProjectDataAtom = atom<AdCloneProjectData | null>(null);
export const adCloneStatusAtom = atom<AdCloneProjectStatus | null>(null);

export const adCloneAnalysisAtom = atom<VideoAnalysis | null>(null);

export const adCloneScriptsAtom = atom<any[] | null>(null);
export const adCloneSelectedVariantAtom = atom(0);

export interface SceneImage {
  sceneId: string;
  imageUrl: string | null;
  status: "pending" | "generating" | "completed" | "failed";
  error?: string;
}
export const adCloneSceneImagesAtom = atom<SceneImage[]>([]);
export const adCloneStoryboardJobIdAtom = atom<string | null>(null);

export const adCloneCharacterIdAtom = atom<number | null>(null);
export const adCloneVoiceIdAtom = atom<string | null>(null);
export const adCloneStepAtom = atom<AdCloneStep>("upload");

export const adCloneProgressAtom = atom(0);
export const adCloneProgressMessageAtom = atom("");
export const adCloneErrorAtom = atom<string | null>(null);

export const adCloneVideoJobIdAtom = atom<string | null>(null);
export const adCloneFinalVideoUrlAtom = atom<string | null>(null);

export const adCloneCanProceedAtom = atom((get) => {
  const video = get(adCloneVideoAtom);
  return !!video;
});

export const adCloneAllScenesCompleteAtom = atom((get) => {
  const sceneImages = get(adCloneSceneImagesAtom);
  if (sceneImages.length === 0) return false;
  return sceneImages.every((s) => s.status === "completed" && s.imageUrl);
});

export const adCloneCanGenerateScriptAtom = atom((get) => {
  const analysis = get(adCloneAnalysisAtom);
  const characterId = get(adCloneCharacterIdAtom);
  return !!(analysis && characterId);
});

export const adCloneCanGenerateVideoAtom = atom((get) => {
  const scripts = get(adCloneScriptsAtom);
  const characterId = get(adCloneCharacterIdAtom);
  const voiceId = get(adCloneVoiceIdAtom);
  return !!(scripts && scripts.length > 0 && characterId && voiceId);
});

export const adCloneSelectedScriptAtom = atom((get) => {
  const scripts = get(adCloneScriptsAtom);
  const selectedIndex = get(adCloneSelectedVariantAtom);
  if (!scripts || scripts.length === 0) return null;
  return scripts[selectedIndex] || scripts[0];
});

export const resetAdCloneAtom = atom(null, (get, set) => {
  const video = get(adCloneVideoAtom);
  const productImage = get(adCloneProductImageAtom);

  if (video?.preview) URL.revokeObjectURL(video.preview);
  if (productImage?.preview) URL.revokeObjectURL(productImage.preview);

  set(adCloneVideoAtom, null);
  set(adCloneProductImageAtom, null);
  set(adCloneProductNameAtom, "");
  set(adCloneProductDescriptionAtom, "");
  set(adCloneAdDirectionAtom, "");

  set(adCloneProjectIdAtom, null);
  set(adCloneProjectDataAtom, null);
  set(adCloneStatusAtom, null);

  set(adCloneAnalysisAtom, null);

  set(adCloneScriptsAtom, null);
  set(adCloneSelectedVariantAtom, 0);

  set(adCloneSceneImagesAtom, []);
  set(adCloneStoryboardJobIdAtom, null);

  set(adCloneCharacterIdAtom, null);
  set(adCloneVoiceIdAtom, null);

  set(adCloneStepAtom, "upload");

  set(adCloneProgressAtom, 0);
  set(adCloneProgressMessageAtom, "");

  set(adCloneErrorAtom, null);

  set(adCloneVideoJobIdAtom, null);
  set(adCloneFinalVideoUrlAtom, null);
});
