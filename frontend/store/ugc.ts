"use client";

import { atom } from "jotai";
import type { Voice } from "@/config/voicesConfig";
import type { UGCScript } from "@/components/ugc-studio/script/types";
import type { VideoGenerationStatus } from "@/api/ugc/video";

export const selectedVoiceAtom = atom<Voice | null>(null);

export const scriptIdAtom = atom<string | null>(null);
export const scriptsAtom = atom<UGCScript[]>([]);
export const selectedVariantIndexAtom = atom(0);
export const productImageKeysAtom = atom<string[]>([]);

export interface SceneImageState {
  status: "idle" | "generating" | "regenerating" | "completed" | "failed";
  jobId?: string;
  generatedImages?: { key: string; url: string; index: number }[];
  imageKey?: string;
  imageUrl?: string;
  userRefinement?: string;
  supportingImageKeys?: string[];
  // Per-scene advanced options
  useEndFrame?: boolean; // Generate/use end frame for this scene
  // Custom uploaded images (skip generation)
  customStartImageKey?: string;
  customStartImageUrl?: string;
  customEndImageKey?: string;
  customEndImageUrl?: string;
  // Custom uploaded B-roll shot images (override generated images)
  customBRollImages?: Record<number, { key: string; url: string }>;
}

export const sceneImagesAtom = atom<Record<string, SceneImageState>>({});

export const allScenesCompleteAtom = atom((get) => {
  const scripts = get(scriptsAtom);
  const selectedIndex = get(selectedVariantIndexAtom);
  const sceneImages = get(sceneImagesAtom);

  const currentScript = scripts[selectedIndex];
  if (!currentScript || !currentScript.scenes) return false;

  return currentScript.scenes.every(
    (scene) => sceneImages[scene.id]?.imageKey
  );
});

// Video Generation state
export const videoJobIdAtom = atom<string | null>(null);
export const videoStatusAtom = atom<VideoGenerationStatus | null>(null);
export const videoPreviewUrlAtom = atom<string | null>(null);
export const editingSceneIdAtom = atom<string | null>(null);
export const isGeneratingVideoAtom = atom(false); // True when generating/finalizing video

// Fresh start flag - set true when loading existing script (only use script text, nothing else)
export const freshStartAtom = atom(false);

// Derived atom: check if video can be finalized
export const canFinalizeAtom = atom((get) => {
  const status = get(videoStatusAtom);
  return status?.status === "completed" && !!status.finalVideoUrl;
});
