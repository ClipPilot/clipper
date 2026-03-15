"use client";

import { atom } from "jotai";
import type { Voice } from "@/config/voicesConfig";
import type { UGCScript } from "@/components/ugc-studio/script/types";
import type { VideoGenerationStatus } from "@/api/ugc/video";
import { videoStateAtom } from "./videoState";

// ---------------------------------------------------------------------------
// Proxy atoms — read/write through videoStateAtom
// These keep downstream consumers (ScriptStep, SceneBuilderStep,
// GenerateVideoStep) working unchanged.
// ---------------------------------------------------------------------------

export const selectedVoiceAtom = atom(
  (get) => get(videoStateAtom).voice,
  (get, set, value: Voice | null) =>
    set(videoStateAtom, { ...get(videoStateAtom), voice: value }),
);

export const scriptIdAtom = atom(
  (get) => get(videoStateAtom).scriptId,
  (get, set, value: string | null) =>
    set(videoStateAtom, { ...get(videoStateAtom), scriptId: value }),
);

export const productImageKeysAtom = atom(
  (get) => get(videoStateAtom).productImageKeys,
  (get, set, value: string[]) =>
    set(videoStateAtom, { ...get(videoStateAtom), productImageKeys: value }),
);

export const isSilentAtom = atom(
  (get) => get(videoStateAtom).isSilent,
  (get, set, value: boolean) =>
    set(videoStateAtom, { ...get(videoStateAtom), isSilent: value }),
);

export const videoTypeAtom = atom(
  (get) => get(videoStateAtom).videoType,
  (get, set, value: string) =>
    set(videoStateAtom, { ...get(videoStateAtom), videoType: value }),
);

export const hasCharacterAtom = atom(
  (get) => get(videoStateAtom).hasCharacter,
  (get, set, value: boolean) =>
    set(videoStateAtom, { ...get(videoStateAtom), hasCharacter: value }),
);

export const customPatternAtom = atom(
  (get) => get(videoStateAtom).customPattern,
  (get, set, value: { type: string; shot: string }[] | null) =>
    set(videoStateAtom, { ...get(videoStateAtom), customPattern: value }),
);

export const freshStartAtom = atom(
  (get) => get(videoStateAtom).freshStart,
  (get, set, value: boolean) =>
    set(videoStateAtom, { ...get(videoStateAtom), freshStart: value }),
);

// ---------------------------------------------------------------------------
// Scripts atom — derived from VideoState for agentic flow,
// writable for existing-script flow
// ---------------------------------------------------------------------------

// Internal backing atom for existing-script multi-variant data
const _existingScriptsAtom = atom<UGCScript[] | null>(null);

export const scriptsAtom = atom(
  (get) => {
    // If existing scripts were loaded, use those
    const existing = get(_existingScriptsAtom);
    if (existing) return existing;

    // Otherwise, derive from VideoState scenes (single-variant)
    const vs = get(videoStateAtom);
    if (vs.scenes.length === 0) return [];
    return [
      {
        title: vs.targetAudience ? `Script for ${vs.targetAudience}` : "Generated Script",
        hook: vs.scenes[0]?.dialogue || "",
        targetAudience: vs.targetAudience,
        totalEstimatedDuration: vs.scenes.reduce(
          (sum, s) => sum + s.estimatedDurationSeconds,
          0,
        ),
        scenes: vs.scenes,
        viralScore: 0,
        viralReasoning: "",
        productMentions: [],
      },
    ] as UGCScript[];
  },
  (get, set, value: UGCScript[] | ((prev: UGCScript[]) => UGCScript[])) => {
    const prev = get(scriptsAtom);
    const next = typeof value === "function" ? value(prev) : value;
    set(_existingScriptsAtom, next);
  },
);

export const selectedVariantIndexAtom = atom(0);

// ---------------------------------------------------------------------------
// Scene images — standalone (fast-changing polling state)
// ---------------------------------------------------------------------------

export interface SceneImageState {
  status: "idle" | "generating" | "regenerating" | "completed" | "failed";
  jobId?: string;
  generatedImages?: { key: string; url: string; index: number }[];
  imageKey?: string;
  imageUrl?: string;
  userRefinement?: string;
  supportingImageKeys?: string[];
  useEndFrame?: boolean;
  customStartImageKey?: string;
  customStartImageUrl?: string;
  customEndImageKey?: string;
  customEndImageUrl?: string;
  customBRollImages?: Record<number, { key: string; url: string }>;
  regeneratingShotIndex?: number; // which specific shot is being regenerated (undefined = all)
}

export const sceneImagesAtom = atom<Record<string, SceneImageState>>({});

export const allScenesCompleteAtom = atom((get) => {
  const scripts = get(scriptsAtom);
  const selectedIndex = get(selectedVariantIndexAtom);
  const sceneImages = get(sceneImagesAtom);

  const currentScript = scripts[selectedIndex];
  if (!currentScript || !currentScript.scenes) return false;

  return currentScript.scenes.every(
    (scene) => sceneImages[scene.id]?.imageKey,
  );
});

// ---------------------------------------------------------------------------
// Video generation lifecycle — standalone
// ---------------------------------------------------------------------------

export const videoJobIdAtom = atom<string | null>(null);
export const videoStatusAtom = atom<VideoGenerationStatus | null>(null);
