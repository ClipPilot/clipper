"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  Button,
  Textarea,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { EmotionSelector } from "./EmotionSelector";
import { CameraAngleSelector } from "./CameraAngleSelector";
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
  index: number;
  totalScenes: number;
  onUpdate: (updates: Partial<UGCScene>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddBelow: () => void;
  onRemove: () => void;
  onRegenerate: () => void;
  isRegenerating?: boolean;
}

export function SceneCard({
  scene,
  index,
  totalScenes,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onAddBelow,
  onRemove,
  onRegenerate,
  isRegenerating,
}: SceneCardProps) {
  const [isEditingDialogue, setIsEditingDialogue] = useState(false);
  const [editedDialogue, setEditedDialogue] = useState(scene.dialogue);
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [editedAction, setEditedAction] = useState(scene.action);
  const [editingBRollIndex, setEditingBRollIndex] = useState<number | null>(null);
  const [editedBRollShot, setEditedBRollShot] = useState<BRollShot | null>(null);

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

  const handleSaveBRoll = () => {
    if (editingBRollIndex !== null && editedBRollShot && scene.bRollShots) {
      const newBRollShots = [...scene.bRollShots];
      newBRollShots[editingBRollIndex] = editedBRollShot;
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

  const showBRollSection = scene.shotType === "b-roll" || scene.shotType === "mixed";

  return (
    <Card className="bg-surface-elevated border border-border-base overflow-visible">
      <CardBody className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Chip
                  size="sm"
                  className={`${sceneConfig.color} cursor-pointer hover:opacity-80`}
                  startContent={<Icon icon={sceneConfig.icon} width={12} />}
                >
                  {sceneConfig.label}
                </Chip>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Select scene type"
                selectionMode="single"
                selectedKeys={[scene.sceneType]}
                onAction={(key) => onUpdate({ sceneType: key as SceneType })}
                className="bg-surface-elevated"
              >
                {SCENE_TYPES.map((type) => {
                  const typeConfig = SCENE_TYPE_CONFIG[type];
                  return (
                    <DropdownItem
                      key={type}
                      startContent={<Icon icon={typeConfig.icon} width={16} />}
                      className="text-text-primary"
                    >
                      {typeConfig.label}
                    </DropdownItem>
                  );
                })}
              </DropdownMenu>
            </Dropdown>
            <span className="text-xs text-text-muted">
              {scene.estimatedDurationSeconds}s
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip
              isDisabled={scene.shotType !== "mixed"}
              content={
                <div className="max-w-xs p-1 text-xs">
                  <p className="font-medium mb-1">Shot Types:</p>
                  <p><span className="text-blue-400 font-medium">A-roll</span> — Primary footage of the speaker talking directly to camera</p>
                  <p className="mt-1"><span className="text-amber-400 font-medium">B-roll</span> — Supplementary footage (product shots, demos, cutaways)</p>
                </div>
              }
              placement="bottom"
              classNames={{ content: "bg-surface-elevated border border-border-base" }}
            >
              <div>
                <Dropdown>
                  <DropdownTrigger>
                    <Chip
                      size="sm"
                      variant="flat"
                      className={`cursor-pointer hover:opacity-80 ${
                        scene.shotType === "a-roll"
                          ? "bg-blue-500/20 text-blue-400"
                          : scene.shotType === "b-roll"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-purple-500/20 text-purple-400"
                      }`}
                    >
                      {scene.shotType}
                    </Chip>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Select shot type"
                    selectionMode="single"
                    selectedKeys={[scene.shotType]}
                    onAction={(key) => onUpdate({ shotType: key as ShotType })}
                    className="bg-surface-elevated"
                  >
                    {SHOT_TYPES.map((shotType) => (
                      <DropdownItem
                        key={shotType}
                        className={`text-text-primary ${
                          shotType === "a-roll"
                            ? "text-blue-400"
                            : shotType === "b-roll"
                              ? "text-amber-400"
                              : "text-purple-400"
                        }`}
                      >
                        {shotType}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
            </Tooltip>
            <Tooltip content="Regenerate scene" placement="bottom">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onRegenerate}
                isLoading={isRegenerating}
                className="text-text-muted hover:text-accent-400"
              >
                <Icon icon="solar:refresh-bold" width={16} />
              </Button>
            </Tooltip>
          </div>
        </div>

        {isEditingAction ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon icon="solar:running-bold" width={14} className="text-text-muted shrink-0" />
              <span className="text-xs text-text-muted">Action</span>
            </div>
            <Textarea
              value={editedAction}
              onChange={(e) => setEditedAction(e.target.value)}
              placeholder="Enter action..."
              minRows={1}
              classNames={{
                input: "bg-surface-base text-text-primary text-sm",
                inputWrapper: "bg-surface-base border-border-base",
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="flat" onPress={handleCancelActionEdit}>
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

        {isEditingDialogue ? (
          <div className="space-y-2">
            <Textarea
              value={editedDialogue}
              onChange={(e) => setEditedDialogue(e.target.value)}
              placeholder="Enter dialogue..."
              minRows={2}
              classNames={{
                input: "bg-surface-base text-text-primary",
                inputWrapper: "bg-surface-base border-border-base",
              }}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="flat" onPress={handleCancelDialogueEdit}>
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
                "{scene.dialogue}"
              </p>
              <Icon icon="solar:pen-2-linear" width={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </div>
          </div>
        )}

        {/* B-Roll Shots Section */}
        {showBRollSection && (
          <div className="space-y-2 pt-2 border-t border-border-base">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:videocamera-record-bold-duotone" width={16} className="text-amber-400" />
                <span className="text-xs font-medium text-text-secondary">B-Roll Shots</span>
              </div>
              <Button
                size="sm"
                variant="light"
                className="text-amber-400 hover:bg-amber-400/10 h-6 px-2"
                onPress={handleAddBRollShot}
                startContent={<Icon icon="solar:add-circle-linear" width={14} />}
              >
                Add Shot
              </Button>
            </div>

            {scene.bRollShots && scene.bRollShots.length > 0 ? (
              <div className="space-y-2">
                {scene.bRollShots.map((shot, idx) => (
                  <div key={idx} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                    {editingBRollIndex === idx && editedBRollShot ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-amber-400">Shot {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted">Duration:</span>
                            <input
                              type="number"
                              min={1}
                              max={15}
                              value={editedBRollShot.durationSeconds}
                              onChange={(e) =>
                                setEditedBRollShot({
                                  ...editedBRollShot,
                                  durationSeconds: parseInt(e.target.value) || 3,
                                })
                              }
                              className="w-14 bg-surface-base border border-border-base rounded px-2 py-1 text-xs text-text-primary"
                            />
                            <span className="text-xs text-text-muted">s</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-text-muted mb-1 block">Action</label>
                          <Textarea
                            value={editedBRollShot.action}
                            onChange={(e) =>
                              setEditedBRollShot({ ...editedBRollShot, action: e.target.value })
                            }
                            placeholder="What happens in this shot..."
                            minRows={1}
                            classNames={{
                              input: "bg-surface-base text-text-primary text-sm",
                              inputWrapper: "bg-surface-base border-border-base",
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-text-muted mb-1 block">Visual Direction</label>
                          <Textarea
                            value={editedBRollShot.cinematicPrompt}
                            onChange={(e) =>
                              setEditedBRollShot({ ...editedBRollShot, cinematicPrompt: e.target.value })
                            }
                            placeholder="Describe the visual style, framing, lighting..."
                            minRows={2}
                            classNames={{
                              input: "bg-surface-base text-text-primary text-sm",
                              inputWrapper: "bg-surface-base border-border-base",
                            }}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="flat" onPress={handleCancelBRollEdit}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-amber-500 text-white"
                            onPress={handleSaveBRoll}
                          >
                            Save
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
                            <p className="text-sm text-text-primary mb-1">{shot.action}</p>
                            <p className="text-xs text-text-secondary italic line-clamp-2">
                              {shot.cinematicPrompt}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Icon icon="solar:pen-2-linear" width={12} className="text-text-muted" />
                            {scene.bRollShots && scene.bRollShots.length > 1 && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
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
                customValue={scene.customCameraAngle}
                onChange={(cameraAngle: CameraAngle, customCameraAngle?: string) =>
                  onUpdate({ cameraAngle, customCameraAngle })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip content="Move up" placement="top">
              <Button
                isIconOnly
                size="md"
                variant="light"
                onPress={onMoveUp}
                isDisabled={index === 0}
                className="text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:arrow-up-linear" width={20} />
              </Button>
            </Tooltip>
            <Tooltip content="Move down" placement="top">
              <Button
                isIconOnly
                size="md"
                variant="light"
                onPress={onMoveDown}
                isDisabled={index === totalScenes - 1}
                className="text-text-muted hover:text-text-primary"
              >
                <Icon icon="solar:arrow-down-linear" width={20} />
              </Button>
            </Tooltip>
            <Tooltip content="Add scene below" placement="top">
              <Button
                isIconOnly
                size="md"
                variant="light"
                onPress={onAddBelow}
                className="text-text-muted hover:text-green-400"
              >
                <Icon icon="solar:add-circle-linear" width={20} />
              </Button>
            </Tooltip>
            <Tooltip content={canRemove ? "Delete scene" : "Minimum 3 scenes required"} placement="top">
              <Button
                isIconOnly
                size="md"
                variant="light"
                onPress={onRemove}
                isDisabled={!canRemove}
                className="text-text-muted hover:text-red-400 disabled:opacity-30"
              >
                <Icon icon="solar:trash-bin-2-linear" width={20} />
              </Button>
            </Tooltip>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
