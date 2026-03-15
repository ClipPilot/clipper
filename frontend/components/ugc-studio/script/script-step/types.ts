"use client";

import type { Character } from "../../actors/types";
import type { UGCScript, UGCScene, ProductImage, SceneType, ShotType } from "../types";

export type ScriptPhase = "upload" | "generating" | "editing";

export interface ScriptStepProps {
  teamId: number;
  selectedCharacter: Character;
  onContinue?: () => void;
}

export interface CustomPatternStep {
  type: SceneType;
  shot: ShotType | "visual";
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
