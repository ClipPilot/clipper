"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Chip, ProgressBar, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue, useSetAtom } from "jotai";
import { sceneImagesAtom, sceneRefAtom, type SceneImageState } from "@/store/ugc";
import {
  SCENE_TYPE_CONFIG,
  EMOTION_CONFIG,
  type SceneType,
  type Emotion,
  type UGCScript,
  type UGCScene,
  type BRollShot,
} from "@/components/ugc-studio/script/types";
import { calculateCreditCost } from "@/lib/creditCost";

/* -- emotion tag highlighting ---------------------------------------- */

const EMOTION_TAG_STYLES: Record<string, string> = {
  excited: "text-yellow-400 bg-yellow-400/10",
  curious: "text-blue-400 bg-blue-400/10",
  surprised: "text-purple-400 bg-purple-400/10",
  frustrated: "text-red-400 bg-red-400/10",
  relieved: "text-green-400 bg-green-400/10",
  confident: "text-indigo-400 bg-indigo-400/10",
  friendly: "text-pink-400 bg-pink-400/10",
  urgent: "text-orange-400 bg-orange-400/10",
  sincere: "text-rose-400 bg-rose-400/10",
  playful: "text-fuchsia-400 bg-fuchsia-400/10",
  vulnerable: "text-rose-300 bg-rose-300/10",
  skeptical: "text-slate-400 bg-slate-400/10",
  amazed: "text-violet-400 bg-violet-400/10",
  conspiratorial: "text-amber-400 bg-amber-400/10",
  empathetic: "text-pink-300 bg-pink-300/10",
  determined: "text-cyan-400 bg-cyan-400/10",
  whispering: "text-purple-300 bg-purple-300/10",
  dramatic: "text-red-500 bg-red-500/10",
  satisfied: "text-green-300 bg-green-300/10",
  laughing: "text-amber-300 bg-amber-300/10",
};

function highlightEmotionTags(dialogue: string) {
  if (!dialogue) return null;
  const parts = dialogue.split(/(\[[a-zA-Z]+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[([a-zA-Z]+)\]$/);
    if (match) {
      const tag = match[1].toLowerCase();
      const style = EMOTION_TAG_STYLES[tag] || "text-orange-400 bg-orange-400/10";
      return (
        <span key={i} className={`${style} font-semibold px-1 py-0.5 rounded text-[10px]`}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* -- helpers --------------------------------------------------------- */

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
  renderValue,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  renderValue?: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

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
        <div className={`flex-1 ${className ?? ""}`}>
          {renderValue ? renderValue(value) : value}
        </div>
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

/* -- lightbox ------------------------------------------------------- */

const LightboxContext = createContext<(url: string) => void>(() => {});

function ClickableImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const openLightbox = useContext(LightboxContext);
  return (
    <img
      src={src}
      alt={alt}
      className={`${className ?? ""} cursor-zoom-in`}
      onClick={(e) => {
        e.stopPropagation();
        openLightbox(src);
      }}
    />
  );
}

function Lightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
          onClick={onClose}
        >
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.15 }}
            src={src}
            alt="Zoomed shot"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <Icon icon="solar:close-circle-bold" width={24} className="text-white" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -- scene card ----------------------------------------------------- */

function SceneCard({
  scene,
  imageState,
  onSceneUpdate,
  index,
}: {
  scene: UGCScene;
  imageState?: SceneImageState;
  onSceneUpdate: (sceneId: string, patch: Partial<UGCScene>) => void;
  index: number;
}) {
  const setSceneRef = useSetAtom(sceneRefAtom);
  const sceneImages = useAtomValue(sceneImagesAtom);
  const config = SCENE_TYPE_CONFIG[scene.sceneType as SceneType];
  const emotion = scene.emotion;
  const emotionConfig = EMOTION_CONFIG[emotion as Emotion];
  const emotionEmoji = EMOTION_EMOJIS[emotion];
  const hasShots = scene.bRollShots && scene.bRollShots.length > 0;
  const isBRoll = scene.shotType === "b-roll" || scene.shotType === "visual";
  const isGenerating = imageState?.status === "generating" || imageState?.status === "regenerating";
  const isAnyImageGenerating = Object.values(sceneImages).some(
    (img) => img.status === "generating" || img.status === "regenerating",
  );
  const hasImage = !!imageState?.imageUrl;

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
    >
      {/* Scene header */}
      <div className="flex items-center gap-2 flex-wrap px-4 pt-3 pb-2 group/header">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
            config?.color ?? "bg-default-500/10 text-default-400"
          }`}
        >
          <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={13} />
        </div>
        <span className="text-sm font-semibold text-text-accent">
          {scene.sceneNumber}. {config?.label ?? scene.sceneType}
        </span>
        <button
          onClick={() => setSceneRef(`@Scene ${scene.sceneNumber} `)}
          disabled={isAnyImageGenerating}
          className={`opacity-0 group-hover/header:opacity-100 transition-opacity text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
            isAnyImageGenerating
              ? "bg-white/[0.04] text-text-muted/40 cursor-not-allowed"
              : "bg-accent-400/10 text-accent-400 hover:bg-accent-400/20"
          }`}
          title={isAnyImageGenerating ? "Editing unavailable while images are generating" : "Reference this scene in chat"}
        >
          <Icon icon="solar:mention-circle-bold" width={11} />
          @
        </button>

        {/* Shot type badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
            isBRoll
              ? "bg-amber-500/10 text-amber-400"
              : "bg-blue-500/10 text-blue-400"
          }`}
        >
          {scene.shotType}
        </span>

        {/* Shot count */}
        {hasShots && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-white/[0.05] text-text-secondary">
            {scene.bRollShots!.length} shots
          </span>
        )}

        {/* Duration */}
        <span className="text-xs text-text-muted ml-auto">
          {scene.estimatedDurationSeconds}s
        </span>
      </div>

      {/* Content area */}
      <div className="px-4 pb-3 space-y-2.5">
        {/* A-roll scene thumbnail */}
        {!isBRoll && (
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-elevated relative shrink-0">
            {hasImage ? (
              <ClickableImage
                src={imageState!.imageUrl!}
                alt={`Scene ${scene.sceneNumber}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isGenerating ? (
                  <Spinner size="sm" color="accent" />
                ) : (
                  <Icon
                    icon="solar:gallery-add-bold-duotone"
                    width={16}
                    className="text-text-muted/30"
                  />
                )}
              </div>
            )}
            {hasImage && !isGenerating && (
              <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <Icon icon="solar:check-circle-bold" className="text-white" width={10} />
              </div>
            )}
          </div>
        )}
        {/* Emotion badge */}
        {emotion && (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
              emotionConfig?.color ?? "bg-white/[0.05]"
            } ${emotionConfig ? "" : "text-text-secondary"}`}
          >
            {emotionEmoji && <span className="text-xs">{emotionEmoji}</span>}
            <span className="capitalize">{emotion}</span>
          </div>
        )}

        {/* Dialogue with colored emotion tags */}
        {scene.dialogue && (
          <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon icon="solar:chat-round-bold-duotone" width={12} className="text-accent-400" />
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                Dialogue
              </span>
            </div>
            <EditableText
              value={scene.dialogue}
              onChange={(v) => onSceneUpdate(scene.id, { dialogue: v })}
              className="text-xs text-text-secondary leading-relaxed"
              renderValue={highlightEmotionTags}
            />
          </div>
        )}

        {/* Action / direction */}
        {scene.action && (
          <div className="flex items-start gap-2">
            <Icon
              icon="solar:clapperboard-text-bold-duotone"
              width={14}
              className="text-text-muted mt-0.5 shrink-0"
            />
            <EditableText
              value={scene.action}
              onChange={(v) => onSceneUpdate(scene.id, { action: v })}
              className="text-[11px] text-text-muted leading-relaxed italic"
            />
          </div>
        )}

        {/* Ambient sound */}
        {scene.ambientSound && (
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60">
            <Icon icon="solar:soundwave-bold" width={10} className="shrink-0" />
            <span>{scene.ambientSound}</span>
          </div>
        )}

        {/* B-Roll shots */}
        {hasShots && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:camera-bold-duotone" width={13} className="text-amber-400" />
              <span className="text-[11px] font-semibold text-text-accent">
                B-Roll Shots
              </span>
            </div>

            <div className="space-y-1.5">
              {scene.bRollShots!.map((shot, idx) => {
                const shotImage =
                  imageState?.customBRollImages?.[idx] ||
                  imageState?.generatedImages?.find((img) => img.index === idx);
                const shotGenerating =
                  isGenerating &&
                  (imageState?.regeneratingShotIndex === undefined ||
                    imageState?.regeneratingShotIndex === idx);

                return (
                  <div
                    key={idx}
                    className="group/shot flex items-start gap-2.5 bg-surface-elevated/50 rounded-lg p-2.5 relative"
                  >
                    {/* Shot thumbnail */}
                    <div className="w-12 h-12 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden relative">
                      {shotImage?.url ? (
                        <>
                          <ClickableImage
                            src={shotImage.url}
                            alt={`Shot ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {shotGenerating && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Spinner size="sm" color="accent" />
                            </div>
                          )}
                        </>
                      ) : shotGenerating ? (
                        <Spinner size="sm" color="accent" />
                      ) : (
                        <Icon
                          icon={SHOT_TYPE_ICONS[shot.shotType || "PRODUCT"] || "solar:gallery-bold-duotone"}
                          width={16}
                          className="text-text-muted/40"
                        />
                      )}
                    </div>

                    {/* Shot details */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-text-accent">
                          Shot {idx + 1}
                        </span>
                        {shot.shotType && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-white/[0.05] text-text-muted font-medium">
                            {shot.shotType.replace(/_/g, " ")}
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted ml-auto">
                          {shot.durationSeconds}s
                        </span>
                        <button
                          onClick={() => setSceneRef(`@Scene ${scene.sceneNumber} Shot ${idx + 1} `)}
                          disabled={isAnyImageGenerating}
                          className={`opacity-0 group-hover/shot:opacity-100 transition-opacity text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5 ${
                            isAnyImageGenerating
                              ? "bg-white/[0.04] text-text-muted/40 cursor-not-allowed"
                              : "bg-accent-400/10 text-accent-400 hover:bg-accent-400/20"
                          }`}
                          title={isAnyImageGenerating ? "Editing unavailable while images are generating" : "Reference this shot in chat"}
                        >
                          <Icon icon="solar:mention-circle-bold" width={9} />
                          @
                        </button>
                      </div>
                      <EditableText
                        value={shot.action}
                        onChange={(v) => handleBRollShotActionChange(idx, v)}
                        className="text-[10px] text-text-secondary leading-relaxed"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* -- main component ------------------------------------------------- */

interface ScriptPreviewProps {
  script: UGCScript;
  onSceneUpdate: (sceneId: string, patch: Partial<UGCScene>) => void;
  onGenerateImages?: () => void;
  onContinue?: () => void;
  isContinueLoading?: boolean;
}

export function ScriptPreview({ script, onSceneUpdate, onGenerateImages, onContinue, isContinueLoading }: ScriptPreviewProps) {
  const sceneImages = useAtomValue(sceneImagesAtom);
  const totalScenes = script.scenes.length;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const completedCount = script.scenes.filter(
    (s) => sceneImages[s.id]?.status === "completed",
  ).length;
  const allComplete = completedCount === totalScenes && totalScenes > 0;
  const anyGenerating = script.scenes.some(
    (s) =>
      sceneImages[s.id]?.status === "generating" ||
      sceneImages[s.id]?.status === "regenerating",
  );

  return (
    <LightboxContext.Provider value={setLightboxSrc}>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 h-full overflow-y-auto pb-8"
    >
      {/* Progress header */}
      <div className="bg-surface-base border border-border-base rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-400/20 flex items-center justify-center">
              {anyGenerating ? (
                <Spinner size="sm" color="accent" />
              ) : (
                <Icon
                  icon="solar:check-circle-bold-duotone"
                  width={18}
                  className="text-accent-400"
                />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-text-accent">
                {completedCount} of {totalScenes} scenes{" "}
                {anyGenerating ? "generating..." : "complete"}
              </p>
              <p className="text-[11px] text-text-muted">
                {allComplete
                  ? "All scenes have images ready!"
                  : anyGenerating
                    ? "Images generating in the background"
                    : "Image generation pending"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onGenerateImages && !allComplete && !anyGenerating && (
              <Button
 size="sm"
 variant="tertiary"
 className="bg-accent-400/10 text-accent-400 font-medium"
 onPress={onGenerateImages}
 >
                <Icon icon="solar:gallery-add-bold" width={14} />
                Generate Images
              </Button>
            )}
            {allComplete && (
              <span className="text-[11px] text-text-muted">
                {calculateCreditCost(script.scenes)} credits
              </span>
            )}
            <Button variant="primary"
 size="sm"
 isDisabled={!allComplete || !onContinue || isContinueLoading}
 isPending={isContinueLoading}
 onPress={onContinue}
 >
              {isContinueLoading ? "Starting..." : "Generate Video"}
              {!isContinueLoading ? <Icon icon="solar:arrow-right-linear" width={14} /> : undefined}
</Button>
          </div>
        </div>
        <ProgressBar
 value={totalScenes > 0 ? (completedCount / totalScenes) * 100 : 0}
 className="mt-1"
 />
      </div>

      {/* Reference hint */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-accent-400/5 border border-accent-400/10">
        <Icon icon="solar:mention-circle-bold" width={14} className="text-accent-400 shrink-0" />
        <p className="text-[10px] text-text-muted">
          Hover a scene or shot and click <span className="text-accent-400 font-medium">@</span> to reference it in chat, or type <span className="text-accent-400 font-medium">@</span> in the input
        </p>
      </div>

      {/* Title + meta */}
      <div className="space-y-1.5 px-1">
        <h2 className="text-base font-bold text-text-accent">{script.title}</h2>
        {script.targetAudience && (
          <p className="text-[11px] text-text-muted leading-relaxed">
            {script.targetAudience}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Chip size="sm" variant="tertiary" className="text-[11px] bg-accent-400/10 text-accent-400">
            {Math.round(script.totalEstimatedDuration)}s
          </Chip>
          <Chip size="sm" variant="tertiary" color="default" className="text-[11px]">
            {totalScenes} scenes
          </Chip>
        </div>
      </div>

      {/* Vertical scene list */}
      <div className="space-y-3">
        {script.scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            imageState={sceneImages[scene.id]}
            onSceneUpdate={onSceneUpdate}
            index={index}
          />
        ))}
      </div>
    </motion.div>
    <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </LightboxContext.Provider>
  );
}
