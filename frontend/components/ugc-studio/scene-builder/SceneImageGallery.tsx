"use client";

import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { GeneratedImage } from "./types";

interface SceneImageGalleryProps {
  images: GeneratedImage[];
  selectedIndex?: number;
  onSelect: (index: number) => void;
}

export function SceneImageGallery({
  images,
  selectedIndex,
  onSelect,
}: SceneImageGalleryProps) {
  if (images.length === 0) return null;

  const hasSelection = selectedIndex !== undefined && selectedIndex !== null;

  return (
    <div className="space-y-3">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-green-400">
            {images.length} Images Ready!
          </span>
        </div>
        {hasSelection ? (
          <span className="text-xs text-accent-400 flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" width={12} />
            Selected #{selectedIndex + 1}
          </span>
        ) : (
          <span className="text-xs text-amber-400 flex items-center gap-1 animate-pulse">
            <Icon icon="solar:hand-shake-bold" width={12} />
            Click to select one
          </span>
        )}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-4 gap-3">
        {images.map((image, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={image.key}
              onClick={() => onSelect(idx)}
              className={`aspect-[3/4] relative overflow-hidden rounded-xl transition-all duration-200 ${
                isSelected
                  ? "ring-3 ring-accent-400 scale-[1.03] shadow-lg shadow-accent-400/30"
                  : "ring-2 ring-transparent hover:ring-white/30 hover:scale-[1.02]"
              }`}
            >
              <img
                src={image.url}
                alt={`Option ${idx + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Selection overlay */}
              {isSelected ? (
                <div className="absolute inset-0 bg-accent-400/30 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-accent-400 flex items-center justify-center shadow-lg">
                    <Icon icon="solar:check-circle-bold" className="text-white" width={24} />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                    <Icon icon="solar:cursor-bold" className="text-gray-800" width={16} />
                  </div>
                </div>
              )}

              {/* Number badge */}
              <div className={`absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                isSelected
                  ? "bg-accent-400 text-white"
                  : "bg-black/70 text-white"
              }`}>
                {idx + 1}
              </div>
            </button>
          );
        })}
      </div>

      {/* Instruction text */}
      {!hasSelection && (
        <p className="text-center text-xs text-text-muted">
          Click any image above to select it for this scene
        </p>
      )}
    </div>
  );
}
