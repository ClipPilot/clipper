"use client";

import type { Character } from "../../actors/types";
import type { UGCScript, UGCScene, ProductImage, SceneType, ShotType, ScriptSummary } from "../types";

export type ScriptPhase = "upload" | "generating" | "editing";

export interface ScriptStepProps {
  teamId: number;
  selectedCharacter: Character;
  onContinue?: () => void;
}

export interface CustomPatternStep {
  type: SceneType;
  shot: ShotType;
}

export interface ScriptGenerationState {
  isGenerating: boolean;
  generationProgress: number;
  progressMessage: string;
  pendingScriptId: string | null;
  error: string | null;
}

export interface ScriptFormState {
  productImages: ProductImage[];
  productName: string;
  scriptDirection: string;
  selectedStructureId: string;
  customPattern: CustomPatternStep[];
  selectedActorImageIndex: number;
}

export interface ExistingScriptsState {
  scripts: ScriptSummary[];
  isLoading: boolean;
  isLoadingScript: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
}
