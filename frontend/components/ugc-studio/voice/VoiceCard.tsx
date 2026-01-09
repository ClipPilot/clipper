"use client";

import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { Voice } from "@/config/voicesConfig";

interface VoiceCardProps {
  voice: Voice;
  isSelected: boolean;
  isPlaying: boolean;
  progress: number;
  onSelect: () => void;
  onPlayToggle: () => void;
}

export function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  progress,
  onSelect,
  onPlayToggle,
}: VoiceCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative w-full text-left p-3 rounded-xl border-2 transition-all overflow-hidden ${
        isSelected
          ? "border-accent-400 bg-accent-400/10"
          : "border-border-base bg-surface-base hover:border-accent-400/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-text-primary truncate">{voice.name}</span>
            <Chip
              size="sm"
              className={
                voice.gender === "male"
                  ? "bg-blue-500/20 text-blue-500"
                  : "bg-pink-500/20 text-pink-500"
              }
            >
              {voice.gender === "male" ? "M" : "F"}
            </Chip>
          </div>
          <p className="text-xs text-text-tertiary line-clamp-2">{voice.description}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            className={isPlaying ? "bg-accent-400 text-white" : "bg-surface-elevated"}
            onPress={onPlayToggle}
          >
            <Icon icon={isPlaying ? "solar:stop-bold" : "solar:play-bold"} width={16} />
          </Button>
        </div>
      </div>
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-elevated">
          <div
            className="h-full bg-accent-400 transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </button>
  );
}
