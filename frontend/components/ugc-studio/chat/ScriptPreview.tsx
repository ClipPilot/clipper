"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button, Chip, Progress, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { sceneImagesAtom, type SceneImageState } from "@/store/ugc";
import {
  SCENE_TYPE_CONFIG,
  EMOTION_CONFIG,
  type SceneType,
  type Emotion,
  type UGCScript,
  type UGCScene,
  type BRollShot,
} from "@/components/ugc-studio/script/types";

/* -- helpers -------------------------------------------------------- */


const EMOTION_EMOJIS: Record<string, string> = {
  excited: "🤩", curious: "🤔", surprised: "😮", frustrated: "😤",
  relieved: "😌", confident: "😎", friendly: "😊", urgent: "⚡",
  sincere: "🙏", playful: "😜", vulnerable: "🥺", skeptical: "🤨",
  amazed: "🤯", conspiratorial: "🤫", empathetic: "💕", determined: "💪",
  whispering: "🤫", dramatic: "🎭", satisfied: "😌", laughing: "😂",
};

const SHOT_TYPE_ICONS: Record<string, string> = {
  CHARACTER: "solar:user-bold-duotone",
  PRODUCT: "solar:box-minimalistic-bold-duotone",
  CHARACTER_AND_PRODUCT: "solar:hand-stars-bold-duotone",
};

/* -- EditableText --------------------------------------------------- */

function EditableText({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when value changes externally (e.g. storyboard agent update)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Auto-resize + focus on edit start
  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    } else {
      setDraft(value);
    }
  }, [draft, value, onChange]);

  if (!editing) {
    return (
      <div
        className="group/edit flex items-start gap-2 cursor-pointer"
        onClick={() => setEditing(true)}
      >
        <p className={`flex-1 ${className ?? ""}`}>{value}</p>
        <button className="text-text-muted opacity-0 group-hover/edit:opacity-100 hover:text-text-secondary shrink-0 transition-opacity">
          <Icon icon="solar:pen-bold" width={14} />
        </button>
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={`w-full bg-white/[0.04] border border-accent-400/40 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent-400 ${className ?? ""}`}
      rows={1}
    />
  );
}

/* -- sub-components ------------------------------------------------- */

function SceneThumbnail({
  scene,
  isSelected,
  onClick,
  imageUrl,
  imageStatus,
}: {
  scene: UGCScene;
  isSelected: boolean;
  onClick: () => void;
  imageUrl?: string;
  imageStatus?: string;
}) {
  const config = SCENE_TYPE_CONFIG[scene.sceneType as SceneType];

  return (
    <button
      onClick={onClick}
      className={`
        group flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 shrink-0
        ${isSelected
          ? "bg-accent-400/10 ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-elevated"
          : "bg-surface-base hover:bg-surface-elevated hover:ring-1 hover:ring-border-base"
        }
      `}
    >
      {/* Thumbnail */}
      <div
        className={`
          relative w-[100px] h-[132px] rounded-lg overflow-hidden
          ${isSelected ? "ring-2 ring-accent-400" : "ring-1 ring-border-base"}
        `}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
            {imageStatus === "generating" || imageStatus === "regenerating" ? (
              <Spinner size="sm" color="primary" />
            ) : (
              <Icon
                icon="solar:gallery-add-bold-duotone"
                className="text-text-muted"
                width={24}
              />
            )}
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
          <span className="text-[10px] font-bold text-white">{scene.sceneNumber}</span>
        </div>

        {/* Shot type badge */}
        <div
          className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            scene.shotType === "a-roll"
              ? "bg-blue-500/80 text-white"
              : "bg-amber-500/80 text-white"
          }`}
        >
          {scene.shotType === "a-roll" ? "A" : "B"}
        </div>

        {/* Status badge */}
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent-400/50 flex items-center justify-center">
          <Icon
            icon={imageUrl ? "solar:check-circle-bold" : "solar:clock-circle-bold"}
            className="text-white"
            width={12}
          />
        </div>
      </div>

      {/* Scene type label */}
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            config?.color ?? "bg-default-500/10 text-default-400"
          }`}
        >
          <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={10} />
          <span className="capitalize">{config?.label ?? scene.sceneType}</span>
        </div>
        <span className="text-[10px] text-text-muted">{scene.estimatedDurationSeconds}s</span>
      </div>
    </button>
  );
}

function SceneDetailPanel({
  scene,
  imageState,
  onSceneUpdate,
}: {
  scene: UGCScene;
  imageState?: SceneImageState;
  onSceneUpdate: (sceneId: string, patch: Partial<UGCScene>) => void;
}) {
  const config = SCENE_TYPE_CONFIG[scene.sceneType as SceneType];
  const emotion = scene.emotion;
  const emotionConfig = EMOTION_CONFIG[emotion as Emotion];
  const emotionEmoji = EMOTION_EMOJIS[emotion];
  const hasShots = scene.bRollShots && scene.bRollShots.length > 0;
  const isSilent = !scene.dialogue;

  const handleBRollShotActionChange = useCallback(
    (shotIdx: number, newAction: string) => {
      if (!scene.bRollShots) return;
      const updatedShots: BRollShot[] = scene.bRollShots.map((s, i) =>
        i === shotIdx ? { ...s, action: newAction } : s,
      );
      onSceneUpdate(scene.id, { bRollShots: updatedShots });
    },
    [scene.id, scene.bRollShots, onSceneUpdate],
  );

  return (
    <motion.div
      key={scene.sceneNumber}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-surface-base border border-border-base rounded-xl p-4 space-y-4"
    >
      {/* Scene header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-text-primary">
          Scene {scene.sceneNumber}
        </span>

        {/* Scene type badge */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
            config?.color ?? "bg-default-500/10 text-default-400"
          }`}
        >
          <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={11} />
          <span className="capitalize">{config?.label ?? scene.sceneType}</span>
        </div>

        {/* Shot type */}
        <Chip size="sm" variant="flat" className="text-[11px] h-5 bg-white/[0.05] text-text-secondary">
          {scene.shotType}
        </Chip>

        {/* Shot count */}
        {hasShots && (
          <Chip
            size="sm"
            variant="flat"
            className="text-[11px] h-5 bg-white/[0.05] text-text-secondary"
            startContent={<Icon icon="solar:camera-bold" width={11} />}
          >
            {scene.bRollShots!.length} shots
          </Chip>
        )}

        {/* Duration */}
        <span className="text-xs font-semibold text-accent-400">
          {scene.estimatedDurationSeconds} seconds
        </span>
      </div>

      {/* Shot type + duration info */}
      <div className="bg-surface-elevated rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Icon
            icon={isSilent ? "solar:camera-bold-duotone" : "solar:microphone-bold-duotone"}
            width={16}
            className="text-accent-400"
          />
          <span className="text-xs font-medium text-text-secondary">
            {isSilent ? "Silent" : ""} {scene.shotType === "b-roll" ? "B-roll" : "A-roll"}
          </span>
          <span className="text-xs text-text-muted">{scene.estimatedDurationSeconds}s</span>
          <Icon
            icon={isSilent ? "solar:volume-cross-bold" : "solar:volume-loud-bold"}
            width={14}
            className="text-text-muted ml-auto"
          />
        </div>
      </div>

      {/* Action / direction text (editable) */}
      <div className="flex items-start gap-2">
        <Icon icon="solar:pen-new-square-bold-duotone" width={14} className="text-text-muted mt-0.5 shrink-0" />
        <EditableText
          value={scene.action}
          onChange={(v) => onSceneUpdate(scene.id, { action: v })}
          className="text-xs text-text-secondary leading-relaxed"
        />
      </div>

      {/* Emotion badge */}
      {emotion && (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            emotionConfig?.color ?? "bg-white/[0.05]"
          } ${emotionConfig ? "" : "text-text-secondary"}`}
        >
          {emotionEmoji && <span>{emotionEmoji}</span>}
          <span className="capitalize">{emotion}</span>
        </div>
      )}

      {/* Dialogue (editable) */}
      {scene.dialogue && !isSilent && (
        <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon icon="solar:chat-round-bold-duotone" width={12} className="text-text-muted" />
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Dialogue</span>
          </div>
          <EditableText
            value={scene.dialogue}
            onChange={(v) => onSceneUpdate(scene.id, { dialogue: v })}
            className="text-xs text-text-secondary leading-relaxed"
          />
        </div>
      )}

      {/* B-Roll shots */}
      {hasShots && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:camera-bold-duotone" width={14} className="text-amber-400" />
              <span className="text-xs font-semibold text-text-primary">
                B-Roll Shots ({scene.bRollShots!.length})
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {scene.bRollShots!.map((shot, idx) => {
              const shotImage =
                imageState?.customBRollImages?.[idx] ||
                imageState?.generatedImages?.find((img) => img.index === idx);
              const isSceneGenerating = imageState?.status === "generating" || imageState?.status === "regenerating";
              // Show spinner only for the specific shot being regenerated, or all shots if full scene regen
              const shotGenerating = isSceneGenerating && (
                imageState?.regeneratingShotIndex === undefined || imageState?.regeneratingShotIndex === idx
              );

              return (
              <div
                key={idx}
                className="flex items-start gap-3 bg-surface-elevated rounded-lg p-3"
              >
                {/* Shot thumbnail */}
                <div className="w-14 h-14 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden relative">
                  {shotImage?.url ? (
                    <>
                      <img src={shotImage.url} alt={`Shot ${idx + 1}`} className="w-full h-full object-cover" />
                      {shotGenerating && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Spinner size="sm" color="primary" />
                        </div>
                      )}
                    </>
                  ) : shotGenerating ? (
                    <Spinner size="sm" color="primary" />
                  ) : (
                    <Icon
                      icon={SHOT_TYPE_ICONS[shot.shotType || "PRODUCT"] || "solar:gallery-bold-duotone"}
                      width={20}
                      className="text-text-muted"
                    />
                  )}
                </div>

                {/* Shot details (action is editable) */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      Shot {idx + 1}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {shot.durationSeconds}s
                    </span>
                  </div>
                  <EditableText
                    value={shot.action}
                    onChange={(v) => handleBRollShotActionChange(idx, v)}
                    className="text-[11px] text-text-secondary leading-relaxed"
                  />
                </div>
              </div>
              );
            })}
          </div>

          {/* Shots ready count */}
          <div className="flex items-center gap-1.5">
            <Icon icon="solar:check-circle-bold" width={14} className="text-accent-400" />
            <span className="text-xs text-text-muted">
              {scene.bRollShots!.length} shots ready
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* -- main component ------------------------------------------------- */

interface ScriptPreviewProps {
  script: UGCScript;
  onSceneUpdate: (sceneId: string, patch: Partial<UGCScene>) => void;
}

export function ScriptPreview({ script, onSceneUpdate }: ScriptPreviewProps) {
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const selectedScene = script.scenes[selectedSceneIndex];
  const totalScenes = script.scenes.length;
  const sceneImages = useAtomValue(sceneImagesAtom);

  const completedCount = script.scenes.filter(
    (s) => sceneImages[s.id]?.status === "completed",
  ).length;
  const allComplete = completedCount === totalScenes;
  const anyGenerating = script.scenes.some(
    (s) => sceneImages[s.id]?.status === "generating" || sceneImages[s.id]?.status === "regenerating",
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-6 h-full pb-8"
    >
      {/* Progress header */}
      <div className="bg-surface-base border border-border-base rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-400/20 flex items-center justify-center">
              {anyGenerating ? (
                <Spinner size="sm" color="primary" />
              ) : (
                <Icon icon="solar:check-circle-bold-duotone" width={20} className="text-accent-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">
                {completedCount} of {totalScenes} scenes{" "}
                {anyGenerating ? "generating..." : "complete"}
              </p>
              <p className="text-[11px] text-text-muted">
                {allComplete
                  ? "All scenes have images ready!"
                  : anyGenerating
                    ? "Images are being generated in the background"
                    : "Image generation pending"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            color="primary"
            isDisabled={!allComplete}
            endContent={<Icon icon="solar:arrow-right-linear" width={14} />}
          >
            Continue
          </Button>
        </div>
        <Progress
          value={totalScenes > 0 ? (completedCount / totalScenes) * 100 : 0}
          size="sm"
          color="primary"
          className="mt-1"
        />
      </div>

      {/* Timeline / Scenes row */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-base font-bold text-text-primary">Scenes</span>
          {/* <span className="text-xs text-text-muted">Click a scene to edit</span> */}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1">
          {script.scenes.map((scene, index) => {
            const imgState = sceneImages[scene.id];
            return (
              <div key={scene.id} className="flex items-center">
                <SceneThumbnail
                  scene={scene}
                  isSelected={index === selectedSceneIndex}
                  onClick={() => setSelectedSceneIndex(index)}
                  imageUrl={imgState?.imageUrl}
                  imageStatus={imgState?.status}
                />
                {/* Connector between thumbnails */}
                {index < totalScenes - 1 && (
                  <div className="flex items-center px-1.5">
                    <div className="w-5 border-t border-dashed border-white/[0.1]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected scene detail panel */}
      {selectedScene && (
        <SceneDetailPanel
          scene={selectedScene}
          imageState={sceneImages[selectedScene.id]}
          onSceneUpdate={onSceneUpdate}
        />
      )}
    </motion.div>
  );
}
