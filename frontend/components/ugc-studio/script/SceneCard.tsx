"use client";

import { useState } from "react";
import {
  Button,
  TextArea,
  Chip,
  Dropdown,
  Tooltip,
  Switch,
  Slider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { EmotionSelector } from "./EmotionSelector";
import { CameraAngleSelector } from "./CameraAngleSelector";
import { ugcScriptAPI } from "@/api/ugc";
import {
  SCENE_TYPE_CONFIG,
  SCENE_TYPES,
  SHOT_TYPES,
  type UGCScene,
  type BRollShot,
  type Emotion,
  type CameraAngle,
  type SceneType,
  type ShotType,
} from "./types";

interface SceneCardProps {
  scene: UGCScene;
  scriptId: string;
  index: number;
  totalScenes: number;
  onUpdate: (updates: Partial<UGCScene>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  onRemove: () => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
  onSavingStateChange?: (isSaving: boolean) => void;
}

export function SceneCard({
  scene,
  scriptId,
  index,
  totalScenes,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onAddBelow,
  onRemove,
  onRegenerate,
  isRegenerating,
  onSavingStateChange,
}: SceneCardProps) {
  const [isEditingDialogue, setIsEditingDialogue] = useState(false);
  const [editedDialogue, setEditedDialogue] = useState(scene.dialogue);
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [editedAction, setEditedAction] = useState(scene.action);
  const [editingBRollIndex, setEditingBRollIndex] = useState<number | null>(null);
  const [editedBRollShot, setEditedBRollShot] = useState<BRollShot | null>(null);
  const [savingBRollIndex, setSavingBRollIndex] = useState<number | null>(null);

  const sceneConfig = SCENE_TYPE_CONFIG[scene.sceneType];
  const canRemove = totalScenes > 3;

  const handleSaveDialogue = () => {
    if (editedDialogue !== scene.dialogue) {
      onUpdate({ dialogue: editedDialogue });
    }
    setIsEditingDialogue(false);
  };

  const handleCancelDialogueEdit = () => {
    setEditedDialogue(scene.dialogue);
    setIsEditingDialogue(false);
  };

  const handleSaveAction = () => {
    if (editedAction !== scene.action) {
      onUpdate({ action: editedAction });
    }
    setIsEditingAction(false);
  };

  const handleCancelActionEdit = () => {
    setEditedAction(scene.action);
    setIsEditingAction(false);
  };

  const handleStartEditBRoll = (index: number) => {
    if (scene.bRollShots && scene.bRollShots[index]) {
      setEditingBRollIndex(index);
      setEditedBRollShot({ ...scene.bRollShots[index] });
    }
  };

  const handleSaveBRoll = async () => {
    if (editingBRollIndex !== null && editedBRollShot && scene.bRollShots) {
      const currentIndex = editingBRollIndex;
      const originalShot = scene.bRollShots[currentIndex];
      const actionChanged = originalShot.action !== editedBRollShot.action;

      if (actionChanged) {
        setSavingBRollIndex(currentIndex);
        onSavingStateChange?.(true);
        try {
          await ugcScriptAPI.regenerateBRollPrompt({
            scriptId,
            sceneId: scene.id,
            bRollShotIndex: currentIndex,
            newAction: editedBRollShot.action,
          });
        } catch (error) {
          console.error("Failed to regenerate B-roll prompt:", error);
        } finally {
          setSavingBRollIndex(null);
          onSavingStateChange?.(false);
        }
      }

      const newBRollShots = [...scene.bRollShots];
      newBRollShots[currentIndex] = editedBRollShot;
      onUpdate({ bRollShots: newBRollShots });
    }
    setEditingBRollIndex(null);
    setEditedBRollShot(null);
  };

  const handleCancelBRollEdit = () => {
    setEditingBRollIndex(null);
    setEditedBRollShot(null);
  };

  const handleAddBRollShot = () => {
    const newShot: BRollShot = {
      action: "Product showcase",
      cinematicPrompt: "Close-up shot of the product",
      durationSeconds: 3,
      productImageNeeded: true,
    };
    const currentShots = scene.bRollShots || [];
    onUpdate({ bRollShots: [...currentShots, newShot] });
  };

  const handleRemoveBRollShot = (index: number) => {
    if (scene.bRollShots && scene.bRollShots.length > 1) {
      const newBRollShots = scene.bRollShots.filter((_, i) => i !== index);
      onUpdate({ bRollShots: newBRollShots });
    }
  };

  const showBRollSection = scene.shotType === "b-roll";
  const hasArollShots = scene.shotType === "a-roll-multi" && scene.arollShots && scene.arollShots.length > 0;
  const isArollMissingDialogue = scene.shotType === "a-roll" && !scene.dialogue?.trim();
  const isArollMultiMissingDialogue = scene.shotType === "a-roll-multi" && (!scene.arollShots?.length || scene.arollShots.some((s) => !s.dialogue?.trim()));

  return (
    <div className={`rounded-xl bg-surface-elevated border overflow-visible p-4 space-y-3 ${isArollMissingDialogue || isArollMultiMissingDialogue ? "border-red-500/60" : "border-border-base"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dropdown>
<Chip
 size="sm"
 className={`${sceneConfig.color} cursor-pointer hover:opacity-80`}
 >
                  <Icon icon={sceneConfig.icon} width={12} />
                  {sceneConfig.label}
                </Chip>
<Dropdown.Popover>

<Dropdown.Menu
                aria-label="Select scene type"
                selectionMode="single"
                selectedKeys={[scene.sceneType]}
                onAction={(key) => onUpdate({ sceneType: key as SceneType })}
                className="bg-surface-elevated"
              >
                {SCENE_TYPES.map((type) => {
                  const typeConfig = SCENE_TYPE_CONFIG[type];
                  return (
                    <Dropdown.Item
                      key={type}
                      className="text-text-primary"
                    >
                      <Icon icon={typeConfig.icon} width={16} />
                      {typeConfig.label}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
</Dropdown.Popover>
            </Dropdown>
            {scene.mergedSceneTypes && scene.mergedSceneTypes.length > 1 && (
              <Tooltip>
                <Tooltip.Trigger>
                  <Chip
 size="sm"
 variant="tertiary"
 className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 cursor-help"
 >
                    <Icon icon="solar:layers-bold" width={12} />
                    {scene.mergedSceneTypes.length} beats
                  </Chip>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">
                  <div className="text-xs">
                    <p className="font-medium mb-1">Combined beats:</p>
                    {scene.mergedSceneTypes.map((type, i) => (
                      <p key={i} className="flex items-center gap-1">
                        <Icon icon={SCENE_TYPE_CONFIG[type].icon} width={12} />
                        {SCENE_TYPE_CONFIG[type].label}
                      </p>
                    ))}
                  </div>
                </Tooltip.Content>
              </Tooltip>
            )}
            <span className="text-xs text-text-muted">
              {scene.estimatedDurationSeconds}s
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Dropdown>
                <Chip
                  size="sm"
                  variant="tertiary"
                  className={`cursor-pointer hover:opacity-80 ${
                    scene.shotType === "a-roll"
                      ? "bg-blue-500/20 text-blue-400"
                      : scene.shotType === "a-roll-multi"
                      ? "bg-purple-500/20 text-purple-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {scene.shotType}
                </Chip>
<Dropdown.Popover>

<Dropdown.Menu
                aria-label="Select shot type"
                selectionMode="single"
                selectedKeys={[scene.shotType]}
                onAction={(key) => {
                  const newShotType = key as ShotType;
                  const updates: Partial<UGCScene> = { shotType: newShotType };
                  if (newShotType === "a-roll") {
                    // A-roll requires dialogue and ambient sound
                    if (!scene.dialogue) updates.dialogue = "Add dialogue here...";
                    if (!scene.ambientSound) updates.ambientSound = "quiet indoor room tone";
                  } else {
                    // Switching to b-roll — clear ambient sound
                    updates.ambientSound = undefined;
                  }
                  onUpdate(updates);
                }}
                className="bg-surface-elevated"
              >
                {SHOT_TYPES.map((shotType) => (
                  <Dropdown.Item
                    key={shotType}
                    className={
                      shotType === "a-roll" ? "text-blue-400" : shotType === "a-roll-multi" ? "text-purple-400" : "text-amber-400"
                    }
                  >
                    {shotType}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
</Dropdown.Popover>
            </Dropdown>
            <Tooltip>
              <Tooltip.Trigger>
                <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={onRegenerate}
 isPending={isRegenerating}
 className="text-text-muted hover:text-accent-400"
 >
                  <Icon icon="solar:refresh-bold" width={16} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">Regenerate scene</Tooltip.Content>
            </Tooltip>
          </div>
        </div>

        {isEditingAction ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon icon="solar:running-bold" width={14} className="text-text-muted shrink-0" />
              <span className="text-xs text-text-muted">Action</span>
            </div>
            <TextArea
              value={editedAction}
              onChange={(e) => setEditedAction(e.target.value)}
              placeholder="Enter action..."
              rows={1}
              className="bg-surface-base text-text-primary text-sm border-border-base"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="tertiary" onPress={handleCancelActionEdit}>
                Cancel
              </Button>
              <Button
 size="sm"
 className="bg-accent-400 text-white"
 onPress={handleSaveAction}
 >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary transition-colors group"
            onClick={() => setIsEditingAction(true)}
          >
            <Icon icon="solar:running-bold" width={14} className="text-text-muted shrink-0" />
            <span className="flex-1">{scene.action}</span>
            <Icon icon="solar:pen-2-linear" width={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {scene.shotType === "b-roll" && (
          <div className="flex items-center justify-between">
            <Switch
 isSelected={!scene.dialogue}
 onChange={(noVoiceover) => {
 if (noVoiceover) {
 onUpdate({ dialogue: "", estimatedDurationSeconds: scene.estimatedDurationSeconds || 5 });
 } else {
 onUpdate({ dialogue: "Add voiceover text here..." });
 }
 }}
 >
              <span className="text-xs text-text-secondary">No voiceover</span>
            </Switch>
            {!scene.dialogue && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Duration:</span>
                <Slider
 step={1}
 minValue={3}
 maxValue={10}
 value={scene.estimatedDurationSeconds}
 onChange={(val) => onUpdate({ estimatedDurationSeconds: val as number })}
 className="w-24"
 />
                <span className="text-xs text-amber-400 font-medium w-6 text-right">{scene.estimatedDurationSeconds}s</span>
              </div>
            )}
          </div>
        )}

        {hasArollShots && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:microphone-3-bold-duotone" width={14} className="text-purple-400" />
              <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                Conversation ({scene.arollShots!.length} turns)
              </span>
            </div>
            {scene.arollShots!.map((shot, idx) => (
              <div key={idx} className="bg-surface-base rounded-lg p-2.5 border-l-2 border-purple-500/40">
                <div className="flex items-center gap-2 mb-1">
                  <Chip size="sm" className="bg-purple-500/20 text-purple-400 h-5 text-[10px]">
                    Actor {shot.characterIndex + 1}
                  </Chip>
                  <span className="text-[10px] text-text-muted">Turn {idx + 1}</span>
                </div>
                <p className="text-text-primary text-xs leading-relaxed">
                  &quot;{shot.dialogue}&quot;
                </p>
              </div>
            ))}
          </div>
        )}

        {!hasArollShots && (scene.shotType !== "b-roll" || scene.dialogue) && (
          isEditingDialogue ? (
            <div className="space-y-2">
              <TextArea
                value={editedDialogue}
                onChange={(e) => setEditedDialogue(e.target.value)}
                placeholder="Enter dialogue..."
                rows={2}
                className="bg-surface-base text-text-primary border-border-base"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="tertiary" onPress={handleCancelDialogueEdit}>
                  Cancel
                </Button>
                <Button
 size="sm"
 className="bg-accent-400 text-white"
 onPress={handleSaveDialogue}
 >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="bg-surface-base rounded-lg p-3 cursor-pointer hover:bg-surface-base/80 transition-colors group"
              onClick={() => setIsEditingDialogue(true)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-text-primary text-sm leading-relaxed flex-1">
                  &quot;{scene.dialogue}&quot;
                </p>
                <Icon icon="solar:pen-2-linear" width={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </div>
            </div>
          )
        )}

        {isArollMissingDialogue && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <Icon icon="solar:danger-triangle-bold" width={14} className="text-red-400" />
            <span className="text-xs text-red-400">A-roll scenes require dialogue to proceed</span>
          </div>
        )}

        {isArollMultiMissingDialogue && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <Icon icon="solar:danger-triangle-bold" width={14} className="text-red-400" />
            <span className="text-xs text-red-400">Podcast scenes require dialogue in all conversation turns</span>
          </div>
        )}

        {showBRollSection && (
          <div className="space-y-2 pt-2 border-t border-border-base">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:videocamera-record-bold-duotone" width={16} className="text-amber-400" />
                <span className="text-xs font-medium text-text-secondary">B-Roll Shots</span>
              </div>
              <Button
 size="sm"
 variant="tertiary"
 className="text-amber-400 hover:bg-amber-400/10 h-6 px-2"
 onPress={handleAddBRollShot}
 >
                <Icon icon="solar:add-circle-linear" width={14} />
                Add Shot
              </Button>
            </div>

            {scene.bRollShots && scene.bRollShots.length > 0 ? (
              <div className="space-y-2">
                {scene.bRollShots.map((shot, idx) => (
                  <div key={idx} className={`bg-amber-500/5 rounded-lg p-3 ${savingBRollIndex === idx ? "border-2 border-amber-500 animate-pulse" : "border border-amber-500/20"}`}>
                    {editingBRollIndex === idx && editedBRollShot ? (
                      <div className="space-y-3">
                        <span className="text-xs font-medium text-amber-400">Shot {idx + 1}</span>
                        <div>
                          <label className="text-xs text-text-muted mb-1 block">Action</label>
                          <TextArea
                            value={editedBRollShot.action}
                            onChange={(e) =>
                              setEditedBRollShot({ ...editedBRollShot, action: e.target.value })
                            }
                            placeholder="What happens in this shot..."
                            rows={1}
                            className="bg-surface-base text-text-primary text-sm border-border-base"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="tertiary" onPress={handleCancelBRollEdit} isDisabled={savingBRollIndex === editingBRollIndex}>
                            Cancel
                          </Button>
                          <Button
 size="sm"
 className="bg-amber-500 text-white"
 onPress={handleSaveBRoll}
 isPending={savingBRollIndex === editingBRollIndex}
 >
                            {savingBRollIndex === editingBRollIndex ? "Regenerating direction..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer group"
                        onClick={() => handleStartEditBRoll(idx)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-amber-400">Shot {idx + 1}</span>
                              <span className="text-xs text-text-muted">{shot.durationSeconds}s</span>
                            </div>
                            <p className="text-sm text-text-primary">{shot.action}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Icon icon="solar:pen-2-linear" width={12} className="text-text-muted" />
                            {scene.bRollShots && scene.bRollShots.length > 1 && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Button
 isIconOnly
 size="sm"
 variant="tertiary"
 onPress={() => handleRemoveBRollShot(idx)}
 className="text-text-muted hover:text-red-400 min-w-5 w-5 h-5"
 >
                                  <Icon icon="solar:trash-bin-minimalistic-linear" width={12} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="bg-amber-500/5 border border-dashed border-amber-500/30 rounded-lg p-4 text-center cursor-pointer hover:bg-amber-500/10 transition-colors"
                onClick={handleAddBRollShot}
              >
                <Icon icon="solar:add-circle-linear" width={20} className="text-amber-400 mx-auto mb-1" />
                <p className="text-xs text-text-muted">Add B-roll shot directions</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Emotion:</span>
              <EmotionSelector
                value={scene.emotion}
                onChange={(emotion: Emotion) => onUpdate({ emotion })}
                compact
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Camera:</span>
              <CameraAngleSelector
                value={scene.cameraAngle}
                onChange={(cameraAngle: CameraAngle) =>
                  onUpdate({ cameraAngle })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <Tooltip.Trigger>
                <Button
 isIconOnly
 size="md"
 variant="tertiary"
 onPress={onMoveUp}
 isDisabled={index === 0}
 className="text-text-muted hover:text-text-primary"
 >
                  <Icon icon="solar:arrow-up-linear" width={20} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="top">Move up</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger>
                <Button
 isIconOnly
 size="md"
 variant="tertiary"
 onPress={onMoveDown}
 isDisabled={index === totalScenes - 1}
 className="text-text-muted hover:text-text-primary"
 >
                  <Icon icon="solar:arrow-down-linear" width={20} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="top">Move down</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger>
                <Button
 isIconOnly
 size="md"
 variant="tertiary"
 onPress={onAddBelow}
 className="text-text-muted hover:text-green-400"
 >
                  <Icon icon="solar:add-circle-linear" width={20} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="top">Add scene below</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger>
                <Button
 isIconOnly
 size="md"
 variant="tertiary"
 onPress={onRemove}
 isDisabled={!canRemove}
 className="text-text-muted hover:text-red-400 disabled:opacity-30"
 >
                  <Icon icon="solar:trash-bin-2-linear" width={20} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="top">{canRemove ? "Delete scene" : "Minimum 3 scenes required"}</Tooltip.Content>
            </Tooltip>
          </div>
        </div>
    </div>
  );
}
