"use client";

import { useState } from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SceneCard } from "./SceneCard";
import type { UGCScript, UGCScene } from "./types";
import type { Character } from "../actors/types";

interface ScriptEditorProps {
  script: UGCScript;
  character: Character;
  selectedActorImageUrl?: string;
  onSceneUpdate: (sceneIndex: number, updates: Partial<UGCScene>) => void;
  onSceneReorder: (fromIndex: number, toIndex: number) => void;
  onAddScene: (afterIndex: number) => void;
  onRemoveScene: (sceneIndex: number) => void;
  onRegenerateScene: (sceneIndex: number) => Promise<void>;
}

export function ScriptEditor({
  script,
  character,
  selectedActorImageUrl,
  onSceneUpdate,
  onSceneReorder,
  onAddScene,
  onRemoveScene,
  onRegenerateScene,
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
      <Card className="bg-surface-elevated border border-border-base">
        <CardBody className="p-4">
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
                startContent={<Icon icon="solar:star-bold" width={12} />}
                className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400"
              >
                {script.viralScore} viral score
              </Chip>
            </div>
          </div>
          <p className="text-xs text-text-muted mt-3 italic">
            "{script.viralReasoning}"
          </p>
        </CardBody>
      </Card>

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
              index={index}
              totalScenes={script.scenes.length}
              onUpdate={(updates) => onSceneUpdate(index, updates)}
              onMoveUp={() => onSceneReorder(index, index - 1)}
              onMoveDown={() => onSceneReorder(index, index + 1)}
              onAddBelow={() => onAddScene(index)}
              onRemove={() => onRemoveScene(index)}
              onRegenerate={() => handleRegenerate(index)}
              isRegenerating={regeneratingScene === index}
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
