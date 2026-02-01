"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { VideoSegment, formatTime } from "./types";

interface FineTunePanelProps {
  segment: VideoSegment;
  segmentIndex: number;
  startFramePreview: string | null;
  endFramePreview: string | null;
  onAdjustFrames: (edge: "start" | "end", frames: number) => void;
  onSeekToBoundary: (edge: "start" | "end") => void;
}

export function FineTunePanel({
  segment,
  segmentIndex,
  startFramePreview,
  endFramePreview,
  onAdjustFrames,
  onSeekToBoundary,
}: FineTunePanelProps) {
  return (
    <div className="p-2 sm:p-3 bg-surface-elevated rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          Fine-tune Segment {segmentIndex + 1}
        </span>
        <span className="text-[10px] text-text-tertiary">
          Duration: <span className="text-accent-400 font-medium">{formatTime(segment.end - segment.start)}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Start (IN) controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wide">Start (IN)</div>
            <div className="font-mono text-[10px] text-text-primary">
              {formatTime(segment.start)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onAdjustFrames("start", -10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <span className="text-[9px] font-medium">-10</span>
            </button>
            <button onClick={() => onAdjustFrames("start", -1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <Icon icon="solar:alt-arrow-left-bold" width={12} />
            </button>
            <button onClick={() => onSeekToBoundary("start")} className="flex-1 h-6 rounded bg-accent-400/20 hover:bg-accent-400/30 flex items-center justify-center text-accent-400 transition-colors">
              <Icon icon="solar:eye-bold" width={12} />
            </button>
            <button onClick={() => onAdjustFrames("start", 1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <Icon icon="solar:alt-arrow-right-bold" width={12} />
            </button>
            <button onClick={() => onAdjustFrames("start", 10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <span className="text-[9px] font-medium">+10</span>
            </button>
          </div>
          <div
            className="relative bg-black rounded overflow-hidden group cursor-pointer max-w-[140px]"
            onClick={() => onSeekToBoundary("start")}
          >
            {startFramePreview ? (
              <img src={startFramePreview} alt="Start frame" className="w-full h-auto" />
            ) : (
              <div className="aspect-video flex items-center justify-center text-text-tertiary">
                <Icon icon="solar:gallery-bold" width={16} />
              </div>
            )}
            <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-green-500/90 rounded text-[8px] text-white font-medium">
              IN
            </div>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-yellow-500">
            <Icon icon="solar:face-scan-circle-bold" width={10} className="shrink-0" />
            <span>Must show a face</span>
          </div>
        </div>

        {/* End (OUT) controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-text-tertiary uppercase tracking-wide">End (OUT)</div>
            <div className="font-mono text-[10px] text-text-primary">
              {formatTime(segment.end)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onAdjustFrames("end", -10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <span className="text-[9px] font-medium">-10</span>
            </button>
            <button onClick={() => onAdjustFrames("end", -1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <Icon icon="solar:alt-arrow-left-bold" width={12} />
            </button>
            <button onClick={() => onSeekToBoundary("end")} className="flex-1 h-6 rounded bg-accent-400/20 hover:bg-accent-400/30 flex items-center justify-center text-accent-400 transition-colors">
              <Icon icon="solar:eye-bold" width={12} />
            </button>
            <button onClick={() => onAdjustFrames("end", 1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <Icon icon="solar:alt-arrow-right-bold" width={12} />
            </button>
            <button onClick={() => onAdjustFrames("end", 10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
              <span className="text-[9px] font-medium">+10</span>
            </button>
          </div>
          <div
            className="relative bg-black rounded overflow-hidden group cursor-pointer max-w-[140px]"
            onClick={() => onSeekToBoundary("end")}
          >
            {endFramePreview ? (
              <img src={endFramePreview} alt="End frame" className="w-full h-auto" />
            ) : (
              <div className="aspect-video flex items-center justify-center text-text-tertiary">
                <Icon icon="solar:gallery-bold" width={16} />
              </div>
            )}
            <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-red-500/90 rounded text-[8px] text-white font-medium">
              OUT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
