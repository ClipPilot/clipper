"use client";

import { useState, useCallback, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Card, CardBody, Chip, Button, Textarea, Select, SelectItem, Spinner, Switch, Slider } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  adCloneScriptsAtom,
  adCloneSelectedVariantAtom,
  adCloneStatusAtom,
  adCloneProgressAtom,
  adCloneProgressMessageAtom,
  adCloneSelectedScriptAtom,
  adCloneProjectIdAtom,
} from "@/store/adClone";
import { useAdClone } from "@/hooks/useAdClone";
import {
  SCENE_TYPE_CONFIG,
  EMOTION_CONFIG,
  SCENE_TYPES,
  EMOTIONS,
  type UGCScene,
  type UGCScript,
  type SceneType,
  type Emotion,
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
  defaultEditing?: boolean;
  onUpdate: (updates: Partial<UGCScene>) => void;
  onRevert: (snapshot: UGCScene) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function SceneEditor({ scene, index, totalScenes, defaultEditing, onUpdate, onRevert, onRemove, onMoveUp, onMoveDown }: SceneEditorProps) {
  const [isEditing, setIsEditing] = useState(defaultEditing ?? false);
  const [snapshot, setSnapshot] = useState<UGCScene | null>(defaultEditing ? { ...scene } : null);
  const sceneTypeConfig = SCENE_TYPE_CONFIG[scene.sceneType as SceneType] || SCENE_TYPE_CONFIG.demo;
  const emotionConfig = EMOTION_CONFIG[scene.emotion as Emotion] || EMOTION_CONFIG.friendly;

  const handleStartEdit = () => {
    setSnapshot({ ...scene });
    setIsEditing(true);
  };

  const handleConfirmEdit = () => {
    setSnapshot(null);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (snapshot) onRevert(snapshot);
    setSnapshot(null);
    setIsEditing(false);
  };

  return (
    <Card className={`bg-surface-elevated border ${isEditing ? "border-orange-500/50" : "border-border-base"}`}>
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-orange-500">{index + 1}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
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

            {scene.shotType === "b-roll" && isEditing && (
              <div className="flex items-center justify-between px-3 py-2 bg-surface-base rounded-lg">
                <Switch
                  size="sm"
                  isSelected={!scene.dialogue}
                  onValueChange={(noVoiceover) => {
                    if (noVoiceover) {
                      onUpdate({ dialogue: "", estimatedDurationSeconds: scene.estimatedDurationSeconds || 5 });
                    } else {
                      onUpdate({ dialogue: "Add voiceover text here..." });
                    }
                  }}
                  classNames={{
                    wrapper: "group-data-[selected=true]:bg-amber-500",
                  }}
                >
                  <span className="text-xs text-text-secondary">No voiceover</span>
                </Switch>
                {!scene.dialogue && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Duration:</span>
                    <Slider
                      size="sm"
                      step={1}
                      minValue={3}
                      maxValue={10}
                      value={scene.estimatedDurationSeconds}
                      onChange={(val) => onUpdate({ estimatedDurationSeconds: val as number })}
                      className="w-24"
                      classNames={{
                        track: "bg-surface-elevated",
                        filler: "bg-amber-500",
                        thumb: "bg-amber-500",
                      }}
                    />
                    <span className="text-xs text-amber-400 font-medium w-6 text-right">{scene.estimatedDurationSeconds}s</span>
                  </div>
                )}
              </div>
            )}

            {(scene.shotType !== "b-roll" || scene.dialogue) && (
              <div className="p-3 bg-surface-base rounded-lg">
                <p className="text-xs text-text-tertiary mb-1">Dialogue</p>
                {isEditing ? (
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
                  <p className="text-sm text-text-primary italic">&ldquo;{scene.dialogue}&rdquo;</p>
                )}
              </div>
            )}

            {scene.shotType === "b-roll" && !scene.dialogue && !isEditing && (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <Icon icon="solar:volume-cross-bold" width={14} className="text-amber-400" />
                  <span className="text-xs text-amber-400">Silent B-roll</span>
                  <span className="text-xs text-text-muted">{scene.estimatedDurationSeconds}s</span>
                </div>
              </div>
            )}

            {(scene.action || isEditing) && (
              <div className="p-3 bg-surface-base rounded-lg">
                <p className="text-xs text-text-tertiary mb-1">Shot Plan</p>
                {isEditing ? (
                  <Textarea
                    size="sm"
                    minRows={2}
                    value={scene.action}
                    onValueChange={(value) => onUpdate({ action: value })}
                    classNames={{
                      inputWrapper: "bg-surface-elevated border-border-base",
                      input: "text-text-primary text-sm",
                    }}
                  />
                ) : (
                  <p className="text-sm text-text-secondary">{scene.action}</p>
                )}
              </div>
            )}

            {isEditing && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border-base">
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
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            {isEditing ? (
              <>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  onPress={handleConfirmEdit}
                >
                  <Icon icon="solar:check-circle-bold" width={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="text-text-secondary hover:text-red-400"
                  onPress={handleCancelEdit}
                >
                  <Icon icon="solar:close-circle-bold" width={16} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="text-text-secondary hover:text-text-primary"
                  isDisabled={index === 0}
                  onPress={onMoveUp}
                >
                  <Icon icon="solar:arrow-up-linear" width={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="text-text-secondary hover:text-text-primary"
                  isDisabled={index === totalScenes - 1}
                  onPress={onMoveDown}
                >
                  <Icon icon="solar:arrow-down-linear" width={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="text-text-secondary hover:text-orange-400"
                  onPress={handleStartEdit}
                >
                  <Icon icon="solar:pen-bold" width={16} />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="text-text-secondary hover:text-red-400"
                  isDisabled={totalScenes <= 1}
                  onPress={onRemove}
                >
                  <Icon icon="solar:close-circle-bold" width={16} />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

interface AdCloneScriptStepProps {
  teamId: number;
}

export function AdCloneScriptStep({ teamId }: AdCloneScriptStepProps) {
  const [scripts, setScripts] = useAtom(adCloneScriptsAtom);
  const [selectedVariant, setSelectedVariant] = useAtom(adCloneSelectedVariantAtom);
  const status = useAtomValue(adCloneStatusAtom);
  const progress = useAtomValue(adCloneProgressAtom);
  const progressMessage = useAtomValue(adCloneProgressMessageAtom);
  const selectedScript = useAtomValue(adCloneSelectedScriptAtom) as UGCScript | null;
  const projectId = useAtomValue(adCloneProjectIdAtom);

  const { generateScript } = useAdClone(teamId);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateScript = useCallback(async () => {
    setIsRegenerating(true);
    try {
      await generateScript();
    } catch (error) {
      console.error("Failed to regenerate script:", error);
    } finally {
      setIsRegenerating(false);
    }
  }, [generateScript]);

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

  const handleSceneRevert = useCallback(
    (sceneIndex: number, snapshot: UGCScene) => {
      if (!scripts) return;

      setScripts(
        scripts.map((script, i) => {
          if (i !== selectedVariant) return script;
          return {
            ...script,
            scenes: script.scenes.map((scene: UGCScene, si: number) =>
              si === sceneIndex ? snapshot : scene
            ),
          };
        })
      );
    },
    [scripts, selectedVariant, setScripts]
  );

  const handleRemoveScene = useCallback(
    (sceneIndex: number) => {
      if (!scripts || !selectedScript) return;
      if (selectedScript.scenes.length <= 1) return;

      setScripts(
        scripts.map((script, i) => {
          if (i !== selectedVariant) return script;
          const newScenes = script.scenes.filter((_: UGCScene, idx: number) => idx !== sceneIndex);
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

  const handleMoveScene = useCallback(
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

  const [newSceneId, setNewSceneId] = useState<string | null>(null);

  const handleAddScene = useCallback(() => {
    if (!scripts || !selectedScript) return;

    const id = crypto.randomUUID();
    const newScene: UGCScene = {
      id,
      sceneNumber: selectedScript.scenes.length + 1,
      sceneType: "demo",
      action: "",
      dialogue: "",
      emotion: "friendly",
      estimatedDurationSeconds: 5,
      shotType: "a-roll",
      cameraAngle: "medium-shot",
    };

    setNewSceneId(id);

    setScripts(
      scripts.map((script, i) => {
        if (i !== selectedVariant) return script;
        return {
          ...script,
          scenes: [...script.scenes, newScene],
        };
      })
    );
  }, [scripts, selectedScript, selectedVariant, setScripts]);

  useEffect(() => {
    if (newSceneId) {
      setNewSceneId(null);
    }
  }, [newSceneId]);

  if (status === "analyzing" || status === "generating_script") {
    const isAnalyzing = status === "analyzing";
    const stages = [
      { label: "Analyzing video structure", status: progress >= 50 ? "done" : isAnalyzing ? "active" : "pending" },
      { label: "Extracting scenes & dialogue", status: progress >= 40 ? "done" : progress >= 20 ? "active" : "pending" },
      { label: "Generating adapted script", status: progress >= 100 ? "done" : progress >= 50 ? "active" : "pending" },
    ];

    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Spinner size="lg" color="warning" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-base border-2 border-orange-500 flex items-center justify-center">
                <Icon
                  icon={isAnalyzing ? "solar:cpu-bolt-bold-duotone" : "solar:document-text-bold-duotone"}
                  className="text-orange-500"
                  width={18}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-text-primary">
                {isAnalyzing ? "Analyzing Reference Video" : "Generating Script"}
              </h2>
              <p className="text-text-secondary">
                {isAnalyzing
                  ? "Breaking down the video structure for faithful recreation..."
                  : "Creating a script that matches the original with your product..."}
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

            <Card className="bg-surface-elevated border border-border-base w-full max-w-md">
              <CardBody className="p-4">
                <div className="space-y-3">
                  {stages.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        stage.status === "done"
                          ? "bg-green-500/20 text-green-400"
                          : stage.status === "active"
                            ? "bg-orange-500/20 text-orange-500"
                            : "bg-surface-base text-text-muted"
                      }`}>
                        {stage.status === "done" ? (
                          <Icon icon="solar:check-circle-bold" width={16} />
                        ) : stage.status === "active" ? (
                          <Spinner size="sm" color="warning" />
                        ) : (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <p className={`text-sm ${
                        stage.status === "done"
                          ? "text-green-400"
                          : stage.status === "active"
                            ? "text-text-primary"
                            : "text-text-muted"
                      }`}>
                        {stage.label}
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!selectedScript || !selectedScript.scenes) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-8 text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" className="text-yellow-400 mx-auto mb-4" width={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Script Available</h3>
          <p className="text-text-secondary">Script generation hasn&apos;t completed yet or encountered an error.</p>
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
              <Button
                size="sm"
                variant="flat"
                color="warning"
                startContent={<Icon icon="solar:refresh-bold" width={16} />}
                onPress={handleRegenerateScript}
                isLoading={isRegenerating}
                isDisabled={isRegenerating}
              >
                Regenerate
              </Button>
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
        {selectedScript.scenes.map((scene: UGCScene, index: number) => {
          const isNewScene = scene.id === newSceneId;
          return (
            <div key={scene.id || index}>
              <SceneEditor
                scene={scene}
                index={index}
                totalScenes={selectedScript.scenes.length}
                defaultEditing={isNewScene}
                onUpdate={(updates) => handleSceneUpdate(index, updates)}
                onRevert={(snapshot) => handleSceneRevert(index, snapshot)}
                onRemove={() => handleRemoveScene(index)}
                onMoveUp={() => handleMoveScene(index, index - 1)}
                onMoveDown={() => handleMoveScene(index, index + 1)}
              />
            </div>
          );
        })}

        <button
          onClick={handleAddScene}
          className="w-full p-4 rounded-xl border-2 border-dashed border-border-base hover:border-orange-500/50 bg-surface-base hover:bg-orange-500/5 transition-all flex items-center justify-center gap-2 group"
        >
          <Icon icon="solar:add-circle-bold" className="text-text-muted group-hover:text-orange-500 transition-colors" width={20} />
          <span className="text-sm font-medium text-text-muted group-hover:text-orange-500 transition-colors">Add Scene</span>
        </button>
      </div>
    </div>
  );
}
