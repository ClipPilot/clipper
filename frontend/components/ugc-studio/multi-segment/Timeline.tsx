"use client";

import React, { forwardRef } from "react";
import { Icon } from "@iconify/react";
import { VideoSegment, getSegmentColor, formatTime } from "./types";

interface TimelineProps {
  duration: number;
  segments: VideoSegment[];
  activeSegmentIndex: number;
  currentTime: number;
  thumbnails: string[];
  isGeneratingThumbnails: boolean;
  isDraggingPlayhead: boolean;
  onSeekToPosition: (clientX: number) => void;
  onSegmentMouseDown: (e: React.MouseEvent, index: number, type: "start" | "end" | "segment") => void;
  onPlayheadMouseDown: (e: React.MouseEvent) => void;
}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  function Timeline(
    {
      duration,
      segments,
      activeSegmentIndex,
      currentTime,
      thumbnails,
      isGeneratingThumbnails,
      isDraggingPlayhead,
      onSeekToPosition,
      onSegmentMouseDown,
      onPlayheadMouseDown,
    },
    ref
  ) {
    const playheadPercent = (currentTime / duration) * 100;

    const renderGaps = () => {
      if (segments.length < 2) return null;

      const sorted = [...segments].sort((a, b) => a.start - b.start);
      const gaps: Array<{ start: number; end: number }> = [];

      if (sorted[0].start > 0.5) gaps.push({ start: 0, end: sorted[0].start });

      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end < sorted[i + 1].start - 0.1) {
          gaps.push({ start: sorted[i].end, end: sorted[i + 1].start });
        }
      }

      if (sorted[sorted.length - 1].end < duration - 0.5) {
        gaps.push({ start: sorted[sorted.length - 1].end, end: duration });
      }

      return gaps.map((gap, i) => (
        <div
          key={`gap-${i}`}
          className="absolute top-0 bottom-0 bg-blue-400/15 border-x border-blue-400/40 pointer-events-none flex items-center justify-center z-0"
          style={{
            left: `${(gap.start / duration) * 100}%`,
            width: `${((gap.end - gap.start) / duration) * 100}%`,
          }}
        >
          <span className="text-[10px] text-blue-400/70 font-medium">Original</span>
        </div>
      ));
    };

    return (
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-text-tertiary px-1">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div
          ref={ref}
          className="relative h-16 rounded-lg overflow-hidden bg-surface-elevated cursor-pointer select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-timeline-bg]")) {
              onSeekToPosition(e.clientX);
            }
          }}
        >
          {/* Thumbnails */}
          <div className="absolute inset-0 flex">
            {isGeneratingThumbnails ? (
              <div className="flex-1 flex items-center justify-center">
                <Icon
                  icon="solar:refresh-circle-bold-duotone"
                  className="text-2xl text-text-tertiary animate-spin"
                />
              </div>
            ) : thumbnails.length > 0 ? (
              thumbnails.map((thumb, i) => (
                <div
                  key={i}
                  className="flex-1 h-full"
                  style={{
                    backgroundImage: `url(${thumb})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ))
            ) : (
              <div className="flex-1 bg-surface-elevated" />
            )}
          </div>

          {/* Darkening overlay */}
          <div className="absolute inset-0 bg-black/60" data-timeline-bg />

          {/* Segments */}
          {segments.map((segment, index) => {
            const startPercent = (segment.start / duration) * 100;
            const endPercent = (segment.end / duration) * 100;
            const widthPercent = endPercent - startPercent;
            const color = getSegmentColor(index);
            const isActive = index === activeSegmentIndex;

            return (
              <div key={segment.id}>
                {/* Segment body */}
                <div
                  className={`absolute top-0 bottom-0 ${color.border} border-y-2 cursor-grab active:cursor-grabbing ${isActive ? "z-10" : "z-5 opacity-70"}`}
                  style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                  onMouseDown={(e) => onSegmentMouseDown(e, index, "segment")}
                >
                  <div className="absolute inset-0 bg-transparent" />
                </div>

                {/* Start handle */}
                <div
                  className={`absolute top-0 bottom-0 w-4 cursor-ew-resize group ${isActive ? "z-20" : "z-15"}`}
                  style={{ left: `calc(${startPercent}% - 8px)` }}
                  onMouseDown={(e) => onSegmentMouseDown(e, index, "start")}
                >
                  <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 ${color.handle} group-hover:w-1.5 transition-all`} />
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded ${color.handle} flex items-center justify-center`}>
                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                  </div>
                </div>

                {/* End handle */}
                <div
                  className={`absolute top-0 bottom-0 w-4 cursor-ew-resize group ${isActive ? "z-20" : "z-15"}`}
                  style={{ left: `calc(${endPercent}% - 8px)` }}
                  onMouseDown={(e) => onSegmentMouseDown(e, index, "end")}
                >
                  <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 ${color.handle} group-hover:w-1.5 transition-all`} />
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded ${color.handle} flex items-center justify-center`}>
                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Gap indicators */}
          {renderGaps()}

          {/* Playhead */}
          <div
            className={`absolute top-0 bottom-0 w-4 z-30 cursor-ew-resize group flex justify-center ${isDraggingPlayhead ? "cursor-grabbing" : ""}`}
            style={{ left: `calc(${playheadPercent}% - 8px)` }}
            onMouseDown={onPlayheadMouseDown}
          >
            <div className="w-0.5 h-full bg-white group-hover:w-1 transition-all" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </div>
    );
  }
);
