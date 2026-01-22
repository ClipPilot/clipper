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
  | "analyzing"
  | "analysis"
  | "character"
  | "script"
  | "generate"
  | "preview";

export type AdCloneProjectStatus =
  | "uploading"
  | "analyzing"
  | "analysis_complete"
  | "generating_script"
  | "script_generated"
  | "generating_video"
  | "completed"
  | "failed";

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
  selectedVariantIndex: number;
  referenceVideoUrl?: string;
  productImageUrls?: string[];
  finalVideoUrl?: string;
}

// Input state atoms
export const adCloneVideoAtom = atom<AdCloneVideo | null>(null);
export const adCloneProductImageAtom = atom<AdCloneProduct | null>(null);
export const adCloneProductNameAtom = atom("");
export const adCloneProductDescriptionAtom = atom("");
export const adCloneAdDirectionAtom = atom("");

// Project state atoms
export const adCloneProjectIdAtom = atom<string | null>(null);
export const adCloneProjectDataAtom = atom<AdCloneProjectData | null>(null);
export const adCloneStatusAtom = atom<AdCloneProjectStatus | null>(null);

// Analysis state atoms
export const adCloneAnalysisAtom = atom<VideoAnalysis | null>(null);

// Script state atoms
export const adCloneScriptsAtom = atom<any[] | null>(null);
export const adCloneSelectedVariantAtom = atom(0);

// Character selection atom
export const adCloneCharacterIdAtom = atom<number | null>(null);

// Voice selection atom
export const adCloneVoiceIdAtom = atom<string | null>(null);

// Wizard step atom
export const adCloneStepAtom = atom<AdCloneStep>("upload");

// Progress tracking atoms
export const adCloneProgressAtom = atom(0);
export const adCloneProgressMessageAtom = atom("");

// Error atom
export const adCloneErrorAtom = atom<string | null>(null);

// Video job tracking
export const adCloneVideoJobIdAtom = atom<string | null>(null);
export const adCloneFinalVideoUrlAtom = atom<string | null>(null);

// Derived atoms
export const adCloneCanProceedAtom = atom((get) => {
  const video = get(adCloneVideoAtom);
  const productImage = get(adCloneProductImageAtom);
  const productName = get(adCloneProductNameAtom);
  const productDescription = get(adCloneProductDescriptionAtom);

  return !!(
    video &&
    productImage &&
    productName.trim() &&
    productDescription.trim()
  );
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

// Reset action atom
export const resetAdCloneAtom = atom(null, (get, set) => {
  const video = get(adCloneVideoAtom);
  const productImage = get(adCloneProductImageAtom);

  if (video?.preview) URL.revokeObjectURL(video.preview);
  if (productImage?.preview) URL.revokeObjectURL(productImage.preview);

  // Reset input state
  set(adCloneVideoAtom, null);
  set(adCloneProductImageAtom, null);
  set(adCloneProductNameAtom, "");
  set(adCloneProductDescriptionAtom, "");
  set(adCloneAdDirectionAtom, "");

  // Reset project state
  set(adCloneProjectIdAtom, null);
  set(adCloneProjectDataAtom, null);
  set(adCloneStatusAtom, null);

  // Reset analysis state
  set(adCloneAnalysisAtom, null);

  // Reset script state
  set(adCloneScriptsAtom, null);
  set(adCloneSelectedVariantAtom, 0);

  // Reset character/voice selection
  set(adCloneCharacterIdAtom, null);
  set(adCloneVoiceIdAtom, null);

  // Reset wizard step
  set(adCloneStepAtom, "upload");

  // Reset progress
  set(adCloneProgressAtom, 0);
  set(adCloneProgressMessageAtom, "");

  // Reset error
  set(adCloneErrorAtom, null);

  // Reset video job
  set(adCloneVideoJobIdAtom, null);
  set(adCloneFinalVideoUrlAtom, null);
});
