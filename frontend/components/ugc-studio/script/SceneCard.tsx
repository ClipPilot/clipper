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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { EmotionSelector } from "./EmotionSelector";
import { CameraAngleSelector } from "./CameraAngleSelector";
import {
  SCENE_TYPE_CONFIG,
  SCENE_TYPES,
  SHOT_TYPES,
  type UGCScene,
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
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onMoveUp}
              isDisabled={index === 0}
              className="text-text-muted hover:text-text-primary"
            >
              <Icon icon="solar:arrow-up-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onMoveDown}
              isDisabled={index === totalScenes - 1}
              className="text-text-muted hover:text-text-primary"
            >
              <Icon icon="solar:arrow-down-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onAddBelow}
              className="text-text-muted hover:text-green-400"
            >
              <Icon icon="solar:add-circle-linear" width={16} />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={onRemove}
              isDisabled={!canRemove}
              className="text-text-muted hover:text-red-400 disabled:opacity-30"
            >
              <Icon icon="solar:trash-bin-2-linear" width={16} />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
