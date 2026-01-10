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

// Scene Builder state
export interface SceneImageState {
  status: "idle" | "generating" | "completed" | "failed";
  jobId?: string;
  generatedImages?: { key: string; url: string; index: number }[];
  selectedImageKey?: string;
  selectedImageUrl?: string; // Direct URL for rendering (from API or generation)
  selectedImageIndex?: number;
  userRefinement?: string;
  supportingImageKeys?: string[];
}

export const sceneImagesAtom = atom<Record<string, SceneImageState>>({});

// Derived atom: check if all scenes have selected images
export const allScenesCompleteAtom = atom((get) => {
  const scripts = get(scriptsAtom);
  const selectedIndex = get(selectedVariantIndexAtom);
  const sceneImages = get(sceneImagesAtom);

  const currentScript = scripts[selectedIndex];
  if (!currentScript || !currentScript.scenes) return false;

  return currentScript.scenes.every(
    (scene) => sceneImages[scene.id]?.selectedImageKey
  );
});

// Video Generation state
export const videoJobIdAtom = atom<string | null>(null);
export const videoStatusAtom = atom<VideoGenerationStatus | null>(null);
export const videoPreviewUrlAtom = atom<string | null>(null);
export const editingSceneIdAtom = atom<string | null>(null);

// Derived atom: check if video can be finalized
export const canFinalizeAtom = atom((get) => {
  const status = get(videoStatusAtom);
  return status?.status === "completed" && !!status.finalVideoUrl;
});
