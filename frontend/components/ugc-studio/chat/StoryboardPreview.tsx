"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAtom } from "jotai";
import { motion } from "framer-motion";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { sceneImagesAtom, SceneImageState } from "@/store/ugc";
import { sceneBuilderAPI } from "@/api/sceneBuilder";
import { SCENE_TYPE_CONFIG, type SceneType } from "@/components/ugc-studio/script/types";
import type { ScriptAgentResult } from "./types";
import type { ChatColorTheme } from "./MessageCard";

const EMOTION_TAG_COLORS: Record<string, string> = {
  whispering: "text-purple-400",
  excited: "text-orange-400",
  curious: "text-cyan-400",
  sincere: "text-rose-400",
  playful: "text-yellow-400",
  dramatic: "text-red-400",
  satisfied: "text-green-400",
  amazed: "text-blue-400",
  laughing: "text-amber-400",
};

function highlightEmotionTags(dialogue: string) {
  if (!dialogue) return null;
  const parts = dialogue.split(/(\[[a-z]+\])/gi);
  return parts.map((part, i) => {
    const match = part.match(/^\[([a-z]+)\]$/i);
    if (match) {
      const tag = match[1].toLowerCase();
      const color = EMOTION_TAG_COLORS[tag] || "text-orange-400";
      return <span key={i} className={`${color} font-semibold`}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

const SHOT_TYPE_ICONS: Record<string, string> = {
  CHARACTER: "solar:user-bold-duotone",
  PRODUCT: "solar:box-minimalistic-bold-duotone",
  CHARACTER_AND_PRODUCT: "solar:hand-stars-bold-duotone",
};

interface StoryboardPreviewProps {
  script: ScriptAgentResult;
  scriptId: string | null;
  teamId?: number;
  characterId?: number;
  theme?: ChatColorTheme;
  onContinue?: () => void;
}

export function StoryboardPreview({
  script,
  scriptId,
  teamId,
  characterId,
  theme = "orange",
  onContinue,
}: StoryboardPreviewProps) {
  const [sceneImages, setSceneImages] = useAtom(sceneImagesAtom);
  const pollingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const generationKeyRef = useRef<string | null>(null);

  const isOrange = theme === "orange";
  const accentBg = isOrange ? "bg-orange-500" : "bg-accent-400";
  const accentText = isOrange ? "text-orange-500" : "text-accent-400";
  const accentBgLight = isOrange ? "bg-orange-500/10" : "bg-accent-400/10";

  const completedCount = script.scenes.filter((s: any) => {
    const sceneId = s.id || `scene-${s.sceneNumber}`;
    return sceneImages[sceneId]?.imageKey;
  }).length;
  const allComplete = completedCount === script.scenes.length && script.scenes.length > 0;

  const pollJob = useCallback(
    (jobId: string, sceneId: string) => {
      const interval = setInterval(async () => {
        try {
          const status = await sceneBuilderAPI.getGenerationStatus(jobId);

          if (status.status === "completed" && status.images?.length) {
            clearInterval(interval);
            delete pollingRef.current[sceneId];

            const selectedImage = status.images[0];
            await sceneBuilderAPI.selectSceneImage({
              scriptId: scriptId!,
              sceneId,
              sceneNumber: status.sceneNumber,
              imageKey: selectedImage.key,
              generationJobId: jobId,
            });

            setSceneImages((prev) => ({
              ...prev,
              [sceneId]: {
                status: "completed",
                imageKey: selectedImage.key,
                imageUrl: selectedImage.url,
                generatedImages: status.images,
                jobId,
              },
            }));
          } else if (status.status === "failed") {
            clearInterval(interval);
            delete pollingRef.current[sceneId];
            setSceneImages((prev) => ({
              ...prev,
              [sceneId]: { ...prev[sceneId], status: "failed" },
            }));
          }
        } catch {
          clearInterval(interval);
          delete pollingRef.current[sceneId];
        }
      }, 3000);

      pollingRef.current[sceneId] = interval;
    },
    [scriptId, setSceneImages],
  );

  const generationKey = `${scriptId}-${teamId}-${characterId}`;

  useEffect(() => {
    if (!scriptId || !teamId || !characterId) return;
    if (script.scenes.length === 0) return;
    if (generationKeyRef.current === generationKey) return;

    generationKeyRef.current = generationKey;

    const scenesForApi = script.scenes.map((scene: any) => ({
      sceneId: scene.id || `scene-${scene.sceneNumber}`,
      sceneNumber: scene.sceneNumber,
      sceneType: scene.storyBeat || scene.sceneType,
      dialogue: scene.dialogue || "",
      action: scene.action || "",
      emotion: "confident",
      shotType: scene.sceneType,
      cameraAngle: "medium-shot",
      bRollShots: scene.shots?.length
        ? scene.shots.map((s: any) => ({
            action: s.action,
            cinematicPrompt: s.cinematicPrompt,
            durationSeconds: s.durationSeconds,
          }))
        : null,
    }));

    const initialState: Record<string, SceneImageState> = {};
    for (const s of scenesForApi) {
      initialState[s.sceneId] = { status: "generating" };
    }
    setSceneImages(initialState);

    (async () => {
      try {
        const result = await sceneBuilderAPI.generateAllSceneImages({
          teamId,
          scriptId,
          characterId,
          scenes: scenesForApi,
        });

        result.jobIds.forEach((jobId, i) => {
          const sceneId = scenesForApi[i].sceneId;
          setSceneImages((prev) => ({
            ...prev,
            [sceneId]: { ...prev[sceneId], jobId },
          }));
          pollJob(jobId, sceneId);
        });
      } catch (error) {
        console.error("Failed to generate scene images:", error);
      }
    })();

    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
      pollingRef.current = {};
    };
  }, [generationKey, scriptId, teamId, characterId, script.scenes, setSceneImages, pollJob]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 h-full overflow-y-auto pb-8"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-text-primary">{script.title}</h2>
        <p className="text-xs text-text-muted">{script.targetAudience}</p>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="tertiary" className={`text-[11px] ${accentBgLight} ${accentText}`}>
            {Math.round(script.totalDuration)}s
          </Chip>
          <Chip size="sm" variant="tertiary" color="default" className="text-[11px]">
            {script.scenes.length} scenes
          </Chip>
          <Chip
 size="sm"
 variant="tertiary"
 className={`text-[11px] ${allComplete ? "bg-green-500/10 text-green-400" : `${accentBgLight} ${accentText}`}`}
 >
            {completedCount}/{script.scenes.length} images
          </Chip>
        </div>
      </div>

      <div className="space-y-3">
        {script.scenes.map((scene: any, index: number) => {
          const config = SCENE_TYPE_CONFIG[scene.storyBeat as SceneType];
          const sceneId = scene.id || `scene-${scene.sceneNumber}`;
          const imageState = sceneImages[sceneId];
          const isGenerating = imageState?.status === "generating" || imageState?.status === "regenerating";
          const hasImage = !!imageState?.imageUrl;
          const isBRoll = scene.sceneType === "b-roll" || scene.sceneType === "visual";
          const hasShots = isBRoll && scene.shots && scene.shots.length > 0;
          const shotImages = imageState?.generatedImages || [];

          return (
            <motion.div
              key={scene.sceneNumber}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              {isBRoll && hasShots ? (
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${config?.color ?? "bg-default-500/10 text-default-400"}`}>
                      <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={11} />
                    </div>
                    <span className="text-[12px] font-medium text-text-primary">{scene.sceneNumber}. {scene.slug}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                      scene.sceneType === "visual"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {scene.sceneType}
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">{scene.duration}s</span>
                  </div>

                  {scene.dialogue && (
                    <div className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                      {highlightEmotionTags(scene.dialogue)}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {scene.shots.map((shot: any, si: number) => {
                      const shotImage = shotImages[si];
                      const hasShotImage = !!shotImage?.url;

                      return (
                        <div key={si} className="rounded-lg border border-white/[0.04] bg-white/[0.01] overflow-hidden">
                          <div className="relative aspect-[4/3] bg-surface-elevated">
                            {hasShotImage ? (
                              <img src={shotImage.url} alt={shot.label} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {isGenerating ? (
                                  <Spinner size="sm" color={isOrange ? "warning" : "accent"} />
                                ) : (
                                  <Icon icon="solar:gallery-add-bold-duotone" width={18} className="text-text-muted/20" />
                                )}
                              </div>
                            )}
                            <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                              <Icon icon={SHOT_TYPE_ICONS[shot.shotType] || "solar:widget-bold"} width={10} className="text-white" />
                            </div>
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] text-text-secondary line-clamp-1">{shot.label}</p>
                            <p className="text-[9px] text-text-muted">{shot.durationSeconds}s</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex gap-0">
                  <div className="w-28 shrink-0 relative bg-surface-elevated">
                    {hasImage ? (
                      <img
                        src={imageState.imageUrl}
                        alt={`Scene ${scene.sceneNumber}`}
                        className="w-full h-full object-cover min-h-[140px]"
                      />
                    ) : (
                      <div className="w-full min-h-[140px] flex items-center justify-center">
                        {isGenerating ? (
                          <div className="text-center">
                            <Spinner size="sm" color={isOrange ? "warning" : "accent"} />
                            <p className="text-[9px] text-text-muted mt-1">Generating</p>
                          </div>
                        ) : (
                          <Icon icon="solar:gallery-add-bold-duotone" width={24} className="text-text-muted/30" />
                        )}
                      </div>
                    )}
                    {hasImage && !isGenerating && (
                      <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full ${accentBg} flex items-center justify-center shadow-sm`}>
                        <Icon icon="solar:check-circle-bold" className="text-white" width={12} />
                      </div>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                      <span className="text-[10px] font-bold text-white">{scene.sceneNumber}</span>
                    </div>
                  </div>

                  <div className="flex-1 p-3 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${config?.color ?? "bg-default-500/10 text-default-400"}`}>
                        <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={11} />
                      </div>
                      <span className="text-[12px] font-medium text-text-primary">{scene.sceneNumber}. {scene.slug}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded font-medium bg-blue-500/10 text-blue-400">
                        a-roll
                      </span>
                      <span className="text-[10px] text-text-muted ml-auto">{scene.duration}s</span>
                    </div>

                    {scene.dialogue && (
                      <div className="text-[11px] text-text-secondary leading-relaxed line-clamp-3">
                        {highlightEmotionTags(scene.dialogue)}
                      </div>
                    )}

                    {scene.action && (
                      <p className="text-[10px] text-text-muted italic line-clamp-1">{scene.action}</p>
                    )}

                    {scene.ambientSound && (
                      <div className="flex items-start gap-1 text-[9px] text-text-muted/40">
                        <Icon icon="solar:soundwave-bold" width={9} className="shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{scene.ambientSound}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {allComplete && onContinue && (
        <Button
 size="md"
 className={`${accentBg} text-white font-semibold w-full`}
 onPress={onContinue}
 >
          <Icon icon="solar:play-bold" width={18} />
          Continue to Generate Video
        </Button>
      )}
    </motion.div>
  );
}
