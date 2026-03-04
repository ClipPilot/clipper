"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ScriptEditor } from "../ScriptEditor";
import { ScriptVariantSelector } from "../ScriptVariantSelector";
import type { UGCScript, UGCScene } from "../types";
import type { Character } from "../../actors/types";

interface ScriptEditingPhaseProps {
  scripts: UGCScript[];
  selectedVariantIndex: number;
  scriptId: string;
  character: Character;
  selectedActorImageUrl: string | undefined;
  isSaving: boolean;
  isSavingBRoll: boolean;
  error: string | null;
  onVariantSelect: (index: number) => void;
  onSceneUpdate: (sceneIndex: number, updates: Partial<UGCScene>) => void;
  onSceneReorder: (fromIndex: number, toIndex: number) => void;
  onAddScene: (afterIndex: number) => void;
  onRemoveScene: (sceneIndex: number) => void;
  onRegenerateScene: (sceneIndex: number) => Promise<void>;
  onSavingBRollChange: (saving: boolean) => void;
  onGoBack: () => void;
  onContinue: () => void;
}

export function ScriptEditingPhase({
  scripts,
  selectedVariantIndex,
  scriptId,
  character,
  selectedActorImageUrl,
  isSaving,
  isSavingBRoll,
  error,
  onVariantSelect,
  onSceneUpdate,
  onSceneReorder,
  onAddScene,
  onRemoveScene,
  onRegenerateScene,
  onSavingBRollChange,
  onGoBack,
  onContinue,
}: ScriptEditingPhaseProps) {
  const selectedScript = scripts[selectedVariantIndex];
  const hasArollWithoutDialogue = selectedScript?.scenes.some(
    (scene) => scene.shotType === "a-roll" && !scene.dialogue?.trim()
  );

  return (
    <div className="space-y-6">
      {scripts.length > 1 && (
        <ScriptVariantSelector
          scripts={scripts}
          selectedIndex={selectedVariantIndex}
          onSelect={onVariantSelect}
        />
      )}

      <ScriptEditor
        script={scripts[selectedVariantIndex]}
        scriptId={scriptId}
        character={character}
        selectedActorImageUrl={selectedActorImageUrl}
        onSceneUpdate={onSceneUpdate}
        onSceneReorder={onSceneReorder}
        onAddScene={onAddScene}
        onRemoveScene={onRemoveScene}
        onRegenerateScene={onRegenerateScene}
        onSavingStateChange={onSavingBRollChange}
      />

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="bordered"
            className="border-border-base text-text-secondary"
            onPress={onGoBack}
            startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
          >
            Edit & Regenerate
          </Button>
        </div>
        <Button
          size="lg"
          className="bg-accent-400 text-white font-semibold"
          onPress={onContinue}
          isLoading={isSaving}
          isDisabled={isSavingBRoll || hasArollWithoutDialogue}
          endContent={!isSaving && <Icon icon="solar:arrow-right-linear" width={16} />}
        >
          {isSaving ? "Saving..." : "Continue to Audio"}
        </Button>
      </div>
    </div>
  );
}
