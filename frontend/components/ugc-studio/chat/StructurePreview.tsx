"use client";

import { motion } from "framer-motion";
import { Button, Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCENE_TYPE_CONFIG, type SceneType } from "@/components/ugc-studio/script/types";
import type { InitAgentResult } from "./types";
import type { ChatColorTheme } from "./MessageCard";

const VIDEO_TYPE_LABELS: Record<string, string> = {
  ugc: "UGC Ad",
  reaction: "Reaction",
  montage: "Montage",
  nocharacter_montage: "No-Character Montage",
};

const SHOT_TYPE_TOOLTIPS: Record<string, string> = {
  "a-roll": "Actor speaking directly to camera",
  "b-roll": "Product shots with voiceover narration",
  "visual": "Silent b-roll — no audio, music only",
};

interface StructurePreviewProps {
  result: InitAgentResult;
  isAccepted?: boolean;
  onAccept?: () => void;
  onRetry?: () => void;
  theme?: ChatColorTheme;
}

export function StructurePreview({ result, isAccepted, onAccept, onRetry, theme = "default" }: StructurePreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-4 w-full backdrop-blur-sm"
    >
      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <Chip size="sm" variant="tertiary" color="accent" className="text-[11px]">
          {VIDEO_TYPE_LABELS[result.videoType] ?? result.videoType}
        </Chip>
        {result.isSilent && (
          <Chip size="sm" variant="tertiary" color="warning" className="text-[11px]">
            <Icon icon="solar:volume-cross-bold" width={12} />
            No Dialogue
          </Chip>
        )}
        {result.character ? (
          <Chip size="sm" variant="tertiary" color="default" className="text-[11px]">
            <Icon icon="solar:user-bold" width={12} />
            Character
          </Chip>
        ) : (
          <Chip size="sm" variant="tertiary" color="default" className="text-[11px]">
            <Icon icon="solar:video-frame-bold" width={12} />
            No Character
          </Chip>
        )}
      </div>

      {/* Target audience */}
      {result.targetAudience && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
          <Icon icon="solar:users-group-rounded-bold-duotone" width={14} className={`shrink-0 mt-0.5 ${theme === "orange" ? "text-orange-500/70" : "text-accent-400/70"}`} />
          <span className="text-[11px] leading-relaxed text-text-secondary">{result.targetAudience}</span>
        </div>
      )}

      {/* Scene flow */}
      <div className="space-y-0.5">
        {result.structure.map((scene, index) => {
          const config = SCENE_TYPE_CONFIG[scene.description as SceneType];
          const isLast = index === result.structure.length - 1;
          const hasBRollShots = (scene.sceneType === "b-roll" || scene.sceneType === "visual") && scene.shots && scene.shots.length > 0;

          return (
            <div key={index}>
              <div className="flex items-start gap-2.5 py-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config?.color ?? "bg-default-500/10 text-default-400"}`}>
                  <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-text-primary">{scene.slug}</span>
                    <Tooltip
 content={SHOT_TYPE_TOOLTIPS[scene.sceneType] ?? scene.sceneType}
 placement="top"
 size="sm"
 delay={200}
 >
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium cursor-help ${
                        scene.sceneType === "a-roll"
                          ? "bg-blue-500/10 text-blue-400"
                          : scene.sceneType === "visual"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {scene.sceneType}
                      </span>
                    </Tooltip>
                  </div>

                  {/* B-roll/visual shots breakdown */}
                  {hasBRollShots && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {scene.shots!.map((shot, shotIdx) => (
                        <div
                          key={shotIdx}
                          className="flex items-center gap-1.5 text-[11px] text-text-muted/70"
                        >
                          <Icon
                            icon={
                              shot.shotType === "PRODUCT"
                                ? "solar:box-minimalistic-bold-duotone"
                                : shot.shotType === "CHARACTER"
                                  ? "solar:user-bold-duotone"
                                  : "solar:hand-stars-bold-duotone"
                            }
                            width={12}
                            className="shrink-0"
                          />
                          <span>{shot.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="flex items-center ml-[13px]">
                  <div className="w-px h-2 bg-white/[0.06]" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-white/[0.06]">
        {isAccepted ? (
          <div className="flex items-center gap-2 py-1">
            <Icon icon="solar:check-circle-bold" width={16} className="text-green-400" />
            <span className="text-[13px] font-medium text-green-400">Structure accepted</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
 size="sm"
 className={`${theme === "orange" ? "bg-orange-500" : "bg-accent-400"} text-white font-semibold flex-1 h-9`}
 onPress={onAccept}
 >
              <Icon icon="solar:check-circle-bold" width={16} />
              Accept
            </Button>
            <Button
 size="sm"
 variant="outline"
 className="border-white/[0.08] text-text-secondary h-9"
 onPress={onRetry}
 >
              <Icon icon="solar:refresh-bold" width={16} />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
