"use client";

import { atom } from "jotai";
import type { InitAgentResult } from "@/components/ugc-studio/chat/types";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import type { Character } from "@/components/ugc-studio/actors/types";
import type { Voice } from "@/config/voicesConfig";

// ---------------------------------------------------------------------------
// VideoState — single source of truth for the UGC video creation flow
// ---------------------------------------------------------------------------

export interface VideoState {
  scriptId: string | null;
  teamId: number | null;

  scenes: UGCScene[]; // empty until script gen completes
  character: Character | null; // null = no character needed or not yet selected
  voice: Voice | null; // null = silent or not yet selected

  videoType: string; // "ugc" | "reaction" | "montage" | "nocharacter_montage"
  isSilent: boolean;
  hasCharacter: boolean; // whether this video needs a character
  targetAudience: string;
  productImageKeys: string[];
  userDirection: string;

  structureBlueprint: InitAgentResult | null; // set on accept, cleared after script gen
  customPattern: { type: string; shot: string }[] | null;
  freshStart: boolean;

  isGeneratingScript: boolean; // loading state during script gen
  threadId: string;
}

export const DEFAULT_VIDEO_STATE: VideoState = {
  scriptId: null,
  teamId: null,
  scenes: [],
  character: null,
  voice: null,
  videoType: "ugc",
  isSilent: false,
  hasCharacter: true,
  targetAudience: "",
  productImageKeys: [],
  userDirection: "",
  structureBlueprint: null,
  customPattern: null,
  freshStart: false,
  isGeneratingScript: false,
  threadId: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
};

export const videoStateAtom = atom<VideoState>(DEFAULT_VIDEO_STATE);

// ---------------------------------------------------------------------------
// Derived helpers — pure functions (can be used outside React)
// ---------------------------------------------------------------------------

export type AgentTarget = "init" | "script-gen" | "storyboard";
export type StepType = "character" | "voice" | "script" | null;

/** Determine which agent the frontend should route chat messages to. */
export function resolveAgent(state: VideoState): AgentTarget {
  if (!state.structureBlueprint && !state.scriptId) return "init";
  if (state.structureBlueprint && !state.scriptId) return "script-gen";
  return "storyboard";
}

/** Determine which artifact panel step to show. */
export function currentStep(state: VideoState): StepType {
  const hasStructureOrScript = state.structureBlueprint || state.scriptId;
  if (!hasStructureOrScript) return null;

  if (state.hasCharacter && !state.character) return "character";
  if (!state.isSilent && !state.voice) return "voice";
  return "script";
}

/** Check if all prerequisites for video generation are met. */
export function isReady(state: VideoState): boolean {
  if (!state.scriptId || state.scenes.length === 0) return false;
  if (state.hasCharacter && !state.character) return false;
  if (!state.isSilent && !state.voice) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Derived atoms — for use in React components via useAtomValue
// ---------------------------------------------------------------------------

export const currentStepAtom = atom((get) => currentStep(get(videoStateAtom)));
export const agentTargetAtom = atom((get) =>
  resolveAgent(get(videoStateAtom)),
);
