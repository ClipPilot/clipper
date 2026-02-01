"use client";

import React, { forwardRef } from "react";
import { Icon } from "@iconify/react";
import { formatTime, formatTimeWithFrames, getSegmentColor } from "./types";

interface VideoPlayerSectionProps {
  videoSrc: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  currentSegmentIndex: number;
  onTogglePlayPause: () => void;
  onStepFrame: (direction: number) => void;
}

export const VideoPlayerSection = forwardRef<HTMLVideoElement, VideoPlayerSectionProps>(
  function VideoPlayerSection(
    {
      videoSrc,
      isPlaying,
      currentTime,
      duration,
      currentSegmentIndex,
      onTogglePlayPause,
      onStepFrame,
    },
    ref
  ) {
    const isInSegment = currentSegmentIndex !== -1;

    return (
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={ref}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
        />
        <button
          onClick={onTogglePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
        >
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Icon
              icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"}
              className="text-white text-2xl ml-1"
            />
          </div>
        </button>
        <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onStepFrame(-1)}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
            title="Previous frame"
          >
            <Icon icon="solar:rewind-back-bold" width={12} />
          </button>
          <button
            onClick={onTogglePlayPause}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
          >
            <Icon icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"} width={14} />
          </button>
          <button
            onClick={() => onStepFrame(1)}
            className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
            title="Next frame"
          >
            <Icon icon="solar:rewind-forward-bold" width={12} />
          </button>
          <div className="hidden sm:block px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
            {formatTimeWithFrames(currentTime)}
          </div>
          {isInSegment ? (
            <div className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium flex items-center gap-1 ${getSegmentColor(currentSegmentIndex).bg}`}>
              <Icon icon="solar:mask-happly-bold" width={10} />
              <span className="hidden xs:inline">Seg</span> {currentSegmentIndex + 1}
            </div>
          ) : (
            <div className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-blue-500/80 text-white text-[10px] sm:text-xs font-medium flex items-center gap-1">
              <Icon icon="solar:video-frame-bold" width={10} />
              <span>Original</span>
            </div>
          )}
        </div>
        <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-black/70 text-white text-[10px] sm:text-xs font-mono">
          {formatTime(duration)}
        </div>
      </div>
    );
  }
);
