"use client";

import { useState, useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Card, CardBody, Chip, Button, Textarea, Select, SelectItem, Spinner, Accordion, AccordionItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneScriptsAtom,
  adCloneSelectedVariantAtom,
  adCloneStatusAtom,
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
  adCloneSelectedScriptAtom,
} from "@/store/adClone";
import {
  SCENE_TYPE_CONFIG,
  EMOTION_CONFIG,
  CAMERA_ANGLE_CONFIG,
  SCENE_TYPES,
  EMOTIONS,
  CAMERA_ANGLES,
  type UGCScene,
  type UGCScript,
  type SceneType,
  type Emotion,
  type CameraAngle,
} from "../script/types";

const SHOT_TYPE_COLORS: Record<string, string> = {
  "a-roll": "bg-green-500/20 text-green-400",
  "b-roll": "bg-blue-500/20 text-blue-400",
  mixed: "bg-purple-500/20 text-purple-400",
};

interface SceneEditorProps {
  scene: UGCScene;
  index: number;
  totalScenes: number;
  onUpdate: (updates: Partial<UGCScene>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SceneEditor({ scene, index, totalScenes, onUpdate, onMoveUp, onMoveDown }: SceneEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sceneTypeConfig = SCENE_TYPE_CONFIG[scene.sceneType as SceneType] || SCENE_TYPE_CONFIG.demo;
  const emotionConfig = EMOTION_CONFIG[scene.emotion as Emotion] || EMOTION_CONFIG.friendly;

  return (
    <Card className="bg-surface-elevated border border-border-base">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-orange-500">{index + 1}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="sm" className={sceneTypeConfig.color} startContent={<Icon icon={sceneTypeConfig.icon} width={12} />}>
                  {sceneTypeConfig.label}
                </Chip>
                <Chip size="sm" className={SHOT_TYPE_COLORS[scene.shotType] || SHOT_TYPE_COLORS["a-roll"]}>
                  {scene.shotType}
                </Chip>
                <Chip size="sm" className={emotionConfig.color}>
                  {emotionConfig.emoji} {emotionConfig.label}
                </Chip>
              </div>
              <div className="flex items-center gap-1 text-sm text-text-tertiary">
                <Icon icon="solar:clock-circle-bold" width={14} />
                <span>{scene.estimatedDurationSeconds}s</span>
              </div>
            </div>

            <div className="p-3 bg-surface-base rounded-lg">
              <p className="text-xs text-text-tertiary mb-1">Dialogue</p>
              {isExpanded ? (
                <Textarea
                  size="sm"
                  minRows={2}
                  value={scene.dialogue}
                  onValueChange={(value) => onUpdate({ dialogue: value })}
                  classNames={{
                    inputWrapper: "bg-surface-elevated border-border-base",
                    input: "text-text-primary text-sm",
                  }}
                />
              ) : (
                <p className="text-sm text-text-primary italic">"{scene.dialogue}"</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Icon icon={CAMERA_ANGLE_CONFIG[scene.cameraAngle as CameraAngle]?.icon || "solar:camera-bold"} width={14} />
              <span>{CAMERA_ANGLE_CONFIG[scene.cameraAngle as CameraAngle]?.label || scene.cameraAngle}</span>
              {scene.action && (
                <>
                  <span className="text-text-muted">•</span>
                  <span>{scene.action}</span>
                </>
              )}
            </div>

            {isExpanded && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border-base">
                <Select
                  label="Scene Type"
                  size="sm"
                  selectedKeys={[scene.sceneType]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as SceneType;
                    if (value) onUpdate({ sceneType: value });
                  }}
                  classNames={{
                    trigger: "bg-surface-base border-border-base min-h-9",
                    value: "text-text-primary text-xs capitalize",
                  }}
                >
                  {SCENE_TYPES.map((type) => (
                    <SelectItem key={type} textValue={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  label="Emotion"
                  size="sm"
                  selectedKeys={[scene.emotion]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as Emotion;
                    if (value) onUpdate({ emotion: value });
                  }}
                  classNames={{
                    trigger: "bg-surface-base border-border-base min-h-9",
                    value: "text-text-primary text-xs capitalize",
                  }}
                >
                  {EMOTIONS.map((emotion) => (
                    <SelectItem key={emotion} textValue={emotion} className="capitalize">
                      {EMOTION_CONFIG[emotion].emoji} {emotion}
                    </SelectItem>
                  ))}
                </Select>

                <Select
                  label="Camera Angle"
                  size="sm"
                  selectedKeys={[scene.cameraAngle]}
                  onSelectionChange={(keys) => {
                    const value = Array.from(keys)[0] as CameraAngle;
                    if (value) onUpdate({ cameraAngle: value });
                  }}
                  classNames={{
                    trigger: "bg-surface-base border-border-base min-h-9",
                    value: "text-text-primary text-xs",
                  }}
                >
                  {CAMERA_ANGLES.map((angle) => (
                    <SelectItem key={angle} textValue={CAMERA_ANGLE_CONFIG[angle].label}>
                      {CAMERA_ANGLE_CONFIG[angle].label}
                    </SelectItem>
                  ))}
                </Select>

                <div>
                  <label className="text-xs text-text-tertiary block mb-1">Duration (s)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={scene.estimatedDurationSeconds}
                    onChange={(e) => onUpdate({ estimatedDurationSeconds: parseInt(e.target.value) || 5 })}
                    className="w-full h-9 px-3 text-sm bg-surface-base border border-border-base rounded-lg text-text-primary"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="text-text-secondary"
              isDisabled={index === 0}
              onPress={onMoveUp}
            >
              <Icon icon="solar:arrow-up-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="text-text-secondary"
              isDisabled={index === totalScenes - 1}
              onPress={onMoveDown}
            >
              <Icon icon="solar:arrow-down-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className={isExpanded ? "text-orange-500" : "text-text-secondary"}
              onPress={() => setIsExpanded(!isExpanded)}
            >
              <Icon icon={isExpanded ? "solar:minimize-bold" : "solar:pen-bold"} width={16} />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function AdCloneScriptStep() {
  const [scripts, setScripts] = useAtom(adCloneScriptsAtom);
  const [selectedVariant, setSelectedVariant] = useAtom(adCloneSelectedVariantAtom);
  const status = useAtomValue(adCloneStatusAtom);
  const progress = useAtomValue(adCloneProgressAtom);
  const progressMessage = useAtomValue(adCloneProgressMessageAtom);
  const selectedScript = useAtomValue(adCloneSelectedScriptAtom) as UGCScript | null;

  const handleSceneUpdate = useCallback(
    (sceneIndex: number, updates: Partial<UGCScene>) => {
      if (!scripts) return;

      setScripts(
        scripts.map((script, i) => {
          if (i !== selectedVariant) return script;
          return {
            ...script,
            scenes: script.scenes.map((scene: UGCScene, si: number) =>
              si === sceneIndex ? { ...scene, ...updates } : scene
            ),
          };
        })
      );
    },
    [scripts, selectedVariant, setScripts]
  );

  const handleSceneReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!scripts || !selectedScript) return;
      if (toIndex < 0 || toIndex >= selectedScript.scenes.length) return;

      setScripts(
        scripts.map((script, i) => {
          if (i !== selectedVariant) return script;
          const newScenes = [...script.scenes];
          const [moved] = newScenes.splice(fromIndex, 1);
          newScenes.splice(toIndex, 0, moved);
          return {
            ...script,
            scenes: newScenes.map((scene: UGCScene, idx: number) => ({
              ...scene,
              sceneNumber: idx + 1,
            })),
          };
        })
      );
    },
    [scripts, selectedScript, selectedVariant, setScripts]
  );

  if (status === "generating_script") {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Spinner size="lg" color="warning" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 border-orange-500 flex items-center justify-center">
                <Icon icon="solar:document-text-bold-duotone" className="text-orange-500" width={18} />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">
                Adapting Script
              </h2>
              <p className="text-text-secondary">
                Creating a script that matches the original ad structure with your product...
              </p>
            </div>

            <div className="w-full max-w-md space-y-2">
              <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-text-tertiary">
                {progressMessage || `${progress}% complete`}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!selectedScript) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-yellow-400 mx-auto mb-4" width={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Script Available</h3>
          <p className="text-text-secondary">Please go back and select a character to generate the script.</p>
        </CardBody>
      </Card>
    );
  }

  const totalDuration = selectedScript.scenes.reduce(
    (sum: number, scene: UGCScene) => sum + scene.estimatedDurationSeconds,
    0
  );

  return (
    <div className="space-y-6">
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Icon icon="solar:check-circle-bold-duotone" className="text-green-400" width={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-text-primary">{selectedScript.title}</h3>
              <p className="text-xs text-text-tertiary">{selectedScript.targetAudience}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm text-text-secondary">
                <Icon icon="solar:clock-circle-bold" width={16} />
                <span>{totalDuration}s</span>
              </div>
              <Chip
                startContent={<Icon icon="solar:star-bold" width={12} />}
                className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400"
              >
                {selectedScript.viralScore} viral
              </Chip>
            </div>
          </div>

          <p className="text-xs text-text-muted italic">"{selectedScript.viralReasoning}"</p>
        </CardBody>
      </Card>

      {scripts && scripts.length > 1 && (
        <Card className="bg-surface-base border border-border-base">
          <CardBody className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon icon="solar:layers-bold-duotone" className="text-orange-500" width={18} />
              <span className="text-sm font-medium text-text-primary">Script Variants</span>
            </div>
            <div className="flex gap-2">
              {scripts.map((script: UGCScript, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedVariant(index)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    selectedVariant === index
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-border-base bg-surface-elevated hover:border-orange-500/50"
                  }`}
                >
                  <p className="text-sm font-medium text-text-primary">Variant {index + 1}</p>
                  <p className="text-xs text-text-tertiary">{script.scenes.length} scenes</p>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Icon icon="solar:document-text-bold-duotone" className="text-purple-400" width={22} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-text-primary">Scene-by-Scene Script</h3>
          <p className="text-xs text-text-tertiary">
            Click the edit icon on each scene to customize dialogue and settings
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {selectedScript.scenes.map((scene: UGCScene, index: number) => (
          <div key={scene.id || index}>
            <SceneEditor
              scene={scene}
              index={index}
              totalScenes={selectedScript.scenes.length}
              onUpdate={(updates) => handleSceneUpdate(index, updates)}
              onMoveUp={() => handleSceneReorder(index, index - 1)}
              onMoveDown={() => handleSceneReorder(index, index + 1)}
            />
            {index < selectedScript.scenes.length - 1 && (
              <div className="flex justify-center my-2">
                <Icon icon="solar:arrow-down-linear" className="text-text-muted" width={16} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
