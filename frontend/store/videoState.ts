"use client";

import { atom } from "jotai";
import type { InitAgentResult } from "@/components/ugc-studio/chat/types";
import type { UGCScene } from "@/components/ugc-studio/script/types";
import type { Character } from "@/components/ugc-studio/actors/types";
import type { Voice } from "@/config/voicesConfig";

export interface CharacterWithVoice {
  character: Character;
  voiceId?: string;
  voiceName?: string;
}

export interface VideoState {
  scriptId: string | null;
  teamId: number | null;
  scenes: UGCScene[];
  character: Character | null;
  characters: CharacterWithVoice[];
  characterCount: number;
  characterRoles: string[];
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
  characters: [],
  characterCount: 1,
  characterRoles: [],
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

export function currentCharacterIndex(state: VideoState): number {
  if (state.characterCount <= 1) return 0;
  const lastChar = state.characters[state.characters.length - 1];
  if (!lastChar) return 0;
  if (!state.isSilent && !lastChar.voiceId) return state.characters.length - 1;
  return state.characters.length;
}

export function currentStep(state: VideoState): StepType {
  const hasStructureOrScript = state.structureBlueprint || state.scriptId;
  if (!hasStructureOrScript) return null;

  if (state.characterCount <= 1) {
    if (state.hasCharacter && !state.character) return "character";
    if (!state.isSilent && !state.voice) return "voice";
    return "script";
  }

  if (!state.hasCharacter) return "script";

  const filled = state.characters.length;
  if (filled === 0) return "character";

  const lastChar = state.characters[filled - 1];
  if (!state.isSilent && !lastChar.voiceId) return "voice";

  if (filled < state.characterCount) return "character";

  return "script";
}

export function isReady(state: VideoState): boolean {
  if (!state.scriptId || state.scenes.length === 0) return false;
  if (state.characterCount <= 1) {
    if (state.hasCharacter && !state.character) return false;
    if (!state.isSilent && !state.voice) return false;
    return true;
  }
  if (state.hasCharacter && state.characters.length < state.characterCount) return false;
  if (!state.isSilent && state.characters.some((c) => !c.voiceId)) return false;
  return true;
}

export const currentStepAtom = atom((get) => currentStep(get(videoStateAtom)));
export const currentCharacterIndexAtom = atom((get) => currentCharacterIndex(get(videoStateAtom)));
export const agentTargetAtom = atom((get) =>
  resolveAgent(get(videoStateAtom)),
);
