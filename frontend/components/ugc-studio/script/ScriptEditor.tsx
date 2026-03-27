"use client";

import { useState } from "react";
import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SceneCard } from "./SceneCard";
import type { UGCScript, UGCScene } from "./types";
import type { Character } from "../actors/types";

interface ScriptEditorProps {
  script: UGCScript;
  scriptId: string;
  character: Character;
  selectedActorImageUrl?: string;
  onSceneUpdate: (sceneIndex: number, updates: Partial<UGCScene>) => void;
  onSceneReorder: (fromIndex: number, toIndex: number) => void;
  onAddScene: (afterIndex: number) => void;
  onRemoveScene: (sceneIndex: number) => void;
  onRegenerateScene: (sceneIndex: number) => Promise<void>;
  onSavingStateChange?: (isSaving: boolean) => void;
}

export function ScriptEditor({
  script,
  scriptId,
  character,
  selectedActorImageUrl,
  onSceneUpdate,
  onSceneReorder,
  onAddScene,
  onRemoveScene,
  onRegenerateScene,
  onSavingStateChange,
}: ScriptEditorProps) {
  const actorImageUrl = selectedActorImageUrl || character.primaryImageUrl || character.imageUrls?.[0];
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null);

  const handleRegenerate = async (index: number) => {
    setRegeneratingScene(index);
    try {
      await onRegenerateScene(index);
    } finally {
      setRegeneratingScene(null);
    }
  };

  const totalDuration = script.scenes.reduce(
    (sum, scene) => sum + scene.estimatedDurationSeconds,
    0
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-base overflow-hidden bg-surface-elevated p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {script.title}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                {script.targetAudience}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Icon icon="solar:clock-circle-bold" className="text-text-muted" width={16} />
                <span className="text-sm text-text-secondary">{totalDuration}s</span>
              </div>
              <Chip
 className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400"
 >
                <Icon icon="solar:star-bold" width={12} />
                {script.viralScore} viral score
              </Chip>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-3 italic">
            "{script.viralReasoning}"
          </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <div className="flex items-center gap-2">
          <img
            src={actorImageUrl}
            alt={character.name}
            className="w-6 h-6 rounded-full object-cover"
          />
          <span>{character.name}</span>
        </div>
        <span className="text-text-muted">•</span>
        <span>{script.scenes.length} scenes</span>
      </div>

      <div className="space-y-3">
        {script.scenes.map((scene, index) => (
          <div key={scene.id} className="relative">
            <SceneCard
              scene={scene}
              scriptId={scriptId}
              index={index}
              totalScenes={script.scenes.length}
              onUpdate={(updates) => onSceneUpdate(index, updates)}
              onMoveUp={() => onSceneReorder(index, index - 1)}
              onMoveDown={() => onSceneReorder(index, index + 1)}
              onAddBelow={() => onAddScene(index)}
              onRemove={() => onRemoveScene(index)}
              onRegenerate={() => handleRegenerate(index)}
              isRegenerating={regeneratingScene === index}
              onSavingStateChange={onSavingStateChange}
            />
            {index < script.scenes.length - 1 && (
              <div className="flex justify-center my-1">
                <Icon icon="solar:arrow-down-linear" className="text-text-muted" width={16} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
