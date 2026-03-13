"use client";

import { motion } from "framer-motion";
import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCENE_TYPE_CONFIG, type SceneType } from "@/components/ugc-studio/script/types";
import type { ScriptAgentResult } from "./types";

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
  // Match [tag] patterns and colorize them
  const parts = dialogue.split(/(\[[a-z]+\])/gi);
  return parts.map((part, i) => {
    const match = part.match(/^\[([a-z]+)\]$/i);
    if (match) {
      const tag = match[1].toLowerCase();
      const color = EMOTION_TAG_COLORS[tag] || "text-accent-400";
      return (
        <span key={i} className={`${color} font-semibold`}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface ScriptPreviewProps {
  script: ScriptAgentResult;
}

export function ScriptPreview({ script }: ScriptPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-4 h-full overflow-y-auto pb-8"
    >
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-text-primary">{script.title}</h2>
        <p className="text-xs text-text-muted">{script.targetAudience}</p>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="flat" color="primary" className="text-[11px]">
            {Math.round(script.totalDuration)}s
          </Chip>
          <Chip size="sm" variant="flat" color="default" className="text-[11px]">
            {script.scenes.length} scenes
          </Chip>
        </div>
      </div>

      {/* Scene cards */}
      <div className="space-y-2">
        {script.scenes.map((scene, index) => {
          const config = SCENE_TYPE_CONFIG[scene.storyBeat as SceneType];
          const isLast = index === script.scenes.length - 1;
          const hasShots = scene.shots && scene.shots.length > 0;

          return (
            <div key={scene.sceneNumber}>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
                {/* Scene header */}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${config?.color ?? "bg-default-500/10 text-default-400"}`}
                  >
                    <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={12} />
                  </div>
                  <span className="text-[13px] font-medium text-text-primary">
                    {scene.sceneNumber}. {scene.slug}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      scene.sceneType === "a-roll"
                        ? "bg-blue-500/10 text-blue-400"
                        : scene.sceneType === "visual"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {scene.sceneType}
                  </span>
                  <span className="text-[10px] text-text-muted ml-auto">{scene.duration}s</span>
                  {scene.isSilent && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="warning"
                      className="text-[10px] h-5"
                      startContent={<Icon icon="solar:volume-cross-bold" width={10} />}
                    >
                      Visual Only
                    </Chip>
                  )}
                </div>

                {/* Story beat tag */}
                <div className="text-[10px] text-text-muted/60 uppercase tracking-wider">
                  {scene.storyBeat}
                </div>

                {/* Dialogue with highlighted emotion tags */}
                {scene.dialogue && (
                  <div className="text-[12px] text-text-secondary leading-relaxed bg-white/[0.02] rounded-lg p-2">
                    {highlightEmotionTags(scene.dialogue)}
                  </div>
                )}

                {/* Action */}
                <p className="text-[11px] text-text-muted italic">{scene.action}</p>

                {/* Ambient sound */}
                {scene.ambientSound && (
                  <div className="flex items-start gap-1.5 text-[10px] text-text-muted/50">
                    <Icon icon="solar:soundwave-bold" width={10} className="shrink-0 mt-0.5" />
                    <span>{scene.ambientSound}</span>
                  </div>
                )}

                {/* Shot breakdown for b-roll/visual */}
                {hasShots && (
                  <div className="border-t border-white/[0.04] pt-2 mt-1">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                      Shots
                    </div>
                    <div className="space-y-1">
                      {scene.shots.map((shot, shotIdx) => (
                        <div
                          key={shotIdx}
                          className="flex items-center gap-1.5 text-[11px] text-text-secondary"
                        >
                          <Icon
                            icon={
                              shot.shotType === "PRODUCT"
                                ? "solar:box-minimalistic-bold-duotone"
                                : shot.shotType === "CHARACTER"
                                  ? "solar:user-bold-duotone"
                                  : "solar:hand-stars-bold-duotone"
                            }
                            width={10}
                            className="shrink-0"
                          />
                          <span className="flex-1">{shot.label}</span>
                          <span className="text-text-muted">{shot.durationSeconds}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex items-center ml-4">
                  <div className="w-px h-2 bg-white/[0.06]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
