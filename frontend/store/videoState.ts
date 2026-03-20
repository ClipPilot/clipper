"use client";

import { atom } from "jotai";
import type { InitAgentResult } from "@/components/ugc-studio/chat/types";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import type { Character } from "@/components/ugc-studio/actors/types";
import type { Voice } from "@/config/voicesConfig";

export interface VideoState {
  scriptId: string | null;
  teamId: number | null;
  scenes: UGCScene[];
  character: Character | null;
  voice: Voice | null;
  videoType: string;
  isSilent: boolean;
  hasCharacter: boolean;
  targetAudience: string;
  productImageKeys: string[];
  userDirection: string;
  structureBlueprint: InitAgentResult | null;
  customPattern: { type: string; shot: string }[] | null;
  freshStart: boolean;
  isGeneratingScript: boolean;
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

export type AgentTarget = "init" | "script-gen" | "storyboard";
export type StepType = "character" | "voice" | "script" | null;

export function resolveAgent(state: VideoState): AgentTarget {
  if (!state.structureBlueprint && !state.scriptId) return "init";
  if (state.structureBlueprint && !state.scriptId) return "script-gen";
  return "storyboard";
}

export function currentStep(state: VideoState): StepType {
  const hasStructureOrScript = state.structureBlueprint || state.scriptId;
  if (!hasStructureOrScript) return null;

  if (state.hasCharacter && !state.character) return "character";
  if (!state.isSilent && !state.voice) return "voice";
  return "script";
}

export function isReady(state: VideoState): boolean {
  if (!state.scriptId || state.scenes.length === 0) return false;
  if (state.hasCharacter && !state.character) return false;
  if (!state.isSilent && !state.voice) return false;
  return true;
}

export const currentStepAtom = atom((get) => currentStep(get(videoStateAtom)));
export const agentTargetAtom = atom((get) =>
  resolveAgent(get(videoStateAtom)),
);
