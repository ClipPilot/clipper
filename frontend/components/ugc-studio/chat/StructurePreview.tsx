"use client";

import { motion } from "framer-motion";
import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SCENE_TYPE_CONFIG, type SceneType } from "@/components/ugc-studio/script/types";
import type { InitAgentResult } from "./types";

const VIDEO_TYPE_LABELS: Record<string, string> = {
  ugc: "UGC Ad",
  reaction: "Reaction",
  montage: "Montage",
  nocharacter_montage: "No-Character Montage",
};

interface StructurePreviewProps {
  result: InitAgentResult;
  isAccepted?: boolean;
  onAccept?: () => void;
  onRetry?: () => void;
}

export function StructurePreview({ result, isAccepted, onAccept, onRetry }: StructurePreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-surface-dark border border-border-base rounded-xl p-4 space-y-4 w-full"
    >
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Chip size="sm" variant="flat" color="primary">
          {VIDEO_TYPE_LABELS[result.videoType] ?? result.videoType}
        </Chip>
        {result.isSilent && (
          <Chip size="sm" variant="flat" color="warning" startContent={<Icon icon="solar:volume-cross-bold" width={14} />}>
            Silent
          </Chip>
        )}
        {result.character ? (
          <Chip size="sm" variant="flat" color="secondary" startContent={<Icon icon="solar:user-bold" width={14} />}>
            With Character
          </Chip>
        ) : (
          <Chip size="sm" variant="flat" color="default" startContent={<Icon icon="solar:video-frame-bold" width={14} />}>
            No Character
          </Chip>
        )}
      </div>

      {/* Scene flow */}
      <div className="space-y-1">
        {result.structure.map((scene, index) => {
          const config = SCENE_TYPE_CONFIG[scene.description as SceneType];
          const isLast = index === result.structure.length - 1;
          const hasBRollShots = scene.sceneType === "b-roll" && scene.shots && scene.shots.length > 0;

          return (
            <div key={index}>
              <div className="flex items-start gap-3 py-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config?.color ?? "bg-default-500/20 text-default-400"}`}>
                  <Icon icon={config?.icon ?? "solar:widget-bold-duotone"} width={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{scene.slug}</span>
                    <Chip size="sm" variant="flat" className="h-5 text-[10px]">
                      {scene.sceneType}
                    </Chip>
                  </div>
                  <p className="text-xs text-text-secondary truncate">
                    {config?.description ?? scene.description}
                  </p>

                  {/* B-roll shots breakdown */}
                  {hasBRollShots && (
                    <div className="mt-2 flex flex-col gap-1">
                      {scene.shots!.map((shot, shotIdx) => (
                        <div
                          key={shotIdx}
                          className="flex items-center gap-2 text-[11px] text-text-muted"
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
                            className="shrink-0 text-text-muted/60"
                          />
                          <span>{shot.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="flex items-center ml-[15px]">
                  <div className="w-px h-3 bg-border-base" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-border-base">
        {isAccepted ? (
          <div className="flex items-center gap-2 py-1.5">
            <Icon icon="solar:check-circle-bold" width={18} className="text-green-400" />
            <span className="text-sm font-medium text-green-400">Structure accepted</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              className="bg-accent-400 text-white font-semibold flex-1"
              onPress={onAccept}
              startContent={<Icon icon="solar:check-circle-bold" width={18} />}
            >
              Accept
            </Button>
            <Button
              variant="bordered"
              className="border-border-base text-text-secondary"
              onPress={onRetry}
              startContent={<Icon icon="solar:refresh-bold" width={18} />}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
