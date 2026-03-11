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

// Silent mode — set when auto-structure or silent template is selected
export const isSilentAtom = atom(false);

// Agentic UGC v2 — chat-derived state
export const videoTypeAtom = atom<string>("ugc");
export const hasCharacterAtom = atom(true);
export const customPatternAtom = atom<{ type: string; shot: string }[] | null>(null);

// Video Generation state
export const videoJobIdAtom = atom<string | null>(null);
export const videoStatusAtom = atom<VideoGenerationStatus | null>(null);
// Fresh start flag - set true when loading existing script (only use script text, nothing else)
export const freshStartAtom = atom(false);
