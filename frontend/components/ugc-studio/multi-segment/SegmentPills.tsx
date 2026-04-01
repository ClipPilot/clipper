"use client";

import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { VideoSegment, formatTime, getSegmentColor } from "./types";

interface SegmentPillsProps {
  segments: VideoSegment[];
  activeSegmentIndex: number;
  maxSegments: number;
  maxTotalDuration: number;
  totalDuration: number;
  videoFile?: File;
  isDetectingFaces: boolean;
  onSegmentClick: (index: number) => void;
  onPlaySegment: (index: number) => void;
  onRemoveSegment: (index: number) => void;
  onAddSegment: () => void;
  onAutoDetectFaces: () => void;
}

export function SegmentPills({
  segments,
  activeSegmentIndex,
  maxSegments,
  maxTotalDuration,
  totalDuration,
  videoFile,
  isDetectingFaces,
  onSegmentClick,
  onPlaySegment,
  onRemoveSegment,
  onAddSegment,
  onAutoDetectFaces,
}: SegmentPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {segments.map((segment, index) => {
        const color = getSegmentColor(index);
        const segDuration = Math.round((segment.end - segment.start) * 100) / 100;
        const isActive = index === activeSegmentIndex;

        return (
          <div
            key={segment.id}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
              isActive
                ? `${color.border} bg-surface-elevated`
                : "border-border-base hover:border-text-tertiary"
            }`}
            onClick={() => onSegmentClick(index)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlaySegment(index);
              }}
              className={`w-5 h-5 shrink-0 rounded-full ${color.bg} flex items-center justify-center hover:opacity-80 transition-opacity`}
              title="Play this segment"
            >
              <Icon icon="solar:play-bold" className="text-white" width={10} />
            </button>
            <span className="text-[10px] sm:text-xs font-mono text-text-primary whitespace-nowrap">
              {formatTime(segment.start)} - {formatTime(segment.end)}
            </span>
            <span className="text-[10px] sm:text-xs text-text-tertiary hidden sm:inline">({segDuration}s)</span>
            {segments.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSegment(index);
                }}
                className="ml-0.5 sm:ml-1 text-text-tertiary hover:text-red-500 transition-colors"
              >
                <Icon icon="solar:close-circle-bold" width={14} />
              </button>
            )}
          </div>
        );
      })}

      {segments.length < maxSegments && totalDuration < maxTotalDuration - 0.5 && (
        <Button
 size="sm"
 variant="tertiary"
 className="bg-surface-elevated text-text-secondary min-w-0"
 onPress={onAddSegment}
 >
          <Icon icon="solar:add-circle-bold" width={16} />
          <span className="hidden sm:inline">Add at Playhead</span>
          <span className="sm:hidden">Add</span>
        </Button>
      )}

      {videoFile && (
        <Button
 size="sm"
 variant="tertiary"
 className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 min-w-0"
 onPress={onAutoDetectFaces}
 isPending={isDetectingFaces}
 isDisabled={isDetectingFaces}
 >
          {!isDetectingFaces && <Icon icon="solar:face-scan-circle-bold" width={16} />}
          <span className="hidden sm:inline">{isDetectingFaces ? "Detecting..." : "Auto-detect Faces"}</span>
          <span className="sm:hidden">{isDetectingFaces ? "..." : "Detect"}</span>
        </Button>
      )}
    </div>
  );
}
