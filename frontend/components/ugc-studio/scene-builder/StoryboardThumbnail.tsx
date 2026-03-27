"use client";

import { Icon } from "@iconify/react";
import { ProgressBar } from "@heroui/react";
import type { UGCScene } from "../script/types";

interface StoryboardThumbnailProps {
  scene: UGCScene;
  sceneConfig: { label: string; icon: string; color: string };
  imageUrl?: string;
  isSelected: boolean;
  isGenerating: boolean;
  hasImage: boolean;
  progress?: number;
  onClick: () => void;
  onRemove?: () => void;
}

export function StoryboardThumbnail({
  scene,
  sceneConfig,
  imageUrl,
  isSelected,
  isGenerating,
  hasImage,
  progress,
  onClick,
  onRemove,
}: StoryboardThumbnailProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200
        ${isSelected
          ? "bg-accent-400/10 ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-elevated"
          : "bg-surface-base hover:bg-surface-elevated hover:ring-1 hover:ring-border-base"
        }
      `}
    >
      {/* Thumbnail */}
      <div
        className={`
          relative w-24 h-32 rounded-lg overflow-hidden
          ${isGenerating ? "animate-pulse" : ""}
          ${isSelected ? "ring-2 ring-accent-400" : "ring-1 ring-border-base"}
        `}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Scene ${scene.sceneNumber}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
            <Icon
              icon={isGenerating ? "solar:spinner" : "solar:gallery-add-bold-duotone"}
              className={`${isGenerating ? "animate-spin text-accent-400" : "text-text-muted"}`}
              width={24}
            />
          </div>
        )}

        {/* Status badge */}
        {hasImage && !isGenerating && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent-400 flex items-center justify-center shadow-sm">
            <Icon icon="solar:check-circle-bold" className="text-white" width={12} />
          </div>
        )}

        {/* Delete button - visible on hover */}
        {onRemove && !isGenerating && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-500/80 text-white
              flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <Icon icon="solar:close-circle-bold" width={12} />
          </button>
        )}

        {/* Scene number badge */}
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
          <span className="text-[10px] font-bold text-white">{scene.sceneNumber}</span>
        </div>

        {/* Shot type badge */}
        <div
          className={`absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            scene.shotType === "a-roll"
              ? "bg-blue-500/80 text-white"
              : scene.shotType === "b-roll"
                ? "bg-amber-500/80 text-white"
                : "bg-purple-500/80 text-white"
          }`}
        >
          {scene.shotType === "a-roll" ? "A" : scene.shotType === "b-roll" ? "B" : "M"}
        </div>

        {/* Generation progress overlay */}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center">
              <Icon icon="solar:spinner" className="animate-spin text-white mb-1" width={20} />
              {progress !== undefined && (
                <span className="text-[10px] text-white font-medium">{progress}%</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scene type label */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sceneConfig.color}`}>
          <Icon icon={sceneConfig.icon} width={10} />
          <span className="capitalize">{sceneConfig.label}</span>
        </div>
        <span className="text-[10px] text-text-muted">{scene.estimatedDurationSeconds}s</span>
      </div>
    </button>
  );
}
