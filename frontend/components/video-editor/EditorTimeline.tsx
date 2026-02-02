"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Icon } from "@iconify/react";
import WaveSurfer from "wavesurfer.js";
import {
  videoDurationAtom,
  currentTimeAtom,
  trimStateAtom,
  thumbnailsAtom,
  isGeneratingThumbnailsAtom,
  isDraggingPlayheadAtom,
  isDraggingTrimHandleAtom,
  audioStateAtom,
  editorClipAtom,
} from "@/store/videoEditor";

interface EditorTimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSeek: (time: number) => void;
}

export function EditorTimeline({ videoRef, onSeek }: EditorTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [waveformReady, setWaveformReady] = useState(false);
  const [waveformLoading, setWaveformLoading] = useState(false);

  // Atoms
  const duration = useAtomValue(videoDurationAtom);
  const currentTime = useAtomValue(currentTimeAtom);
  const [trimState, setTrimState] = useAtom(trimStateAtom);
  const thumbnails = useAtomValue(thumbnailsAtom);
  const isGeneratingThumbnails = useAtomValue(isGeneratingThumbnailsAtom);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useAtom(isDraggingPlayheadAtom);
  const [isDraggingTrimHandle, setIsDraggingTrimHandle] = useAtom(isDraggingTrimHandleAtom);
  const audioState = useAtomValue(audioStateAtom);
  const clip = useAtomValue(editorClipAtom);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !clip) return;

    const videoUrl = clip.blankVideoUrl || clip.clipUrl;
    if (!videoUrl) return;

    setWaveformLoading(true);
    setWaveformReady(false);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#22c55e",
      progressColor: "#16a34a",
      cursorWidth: 0,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 28,
      normalize: true,
      interact: false,
      hideScrollbar: true,
    });

    ws.load(videoUrl);

    ws.on("ready", () => {
      setWaveformReady(true);
      setWaveformLoading(false);
    });

    ws.on("error", (err) => {
      console.error("WaveSurfer error:", err);
      setWaveformLoading(false);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [clip]);

  // Calculate positions
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimStartPercent = duration > 0 ? (trimState.startTime / duration) * 100 : 0;
  const trimEndPercent = duration > 0 ? (trimState.endTime / duration) * 100 : 100;

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Get time from mouse position
  const getTimeFromPosition = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current || duration === 0) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return percent * duration;
    },
    [duration]
  );

  // Handle timeline click
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingPlayhead || isDraggingTrimHandle) return;
      const time = getTimeFromPosition(e.clientX);
      onSeek(time);
    },
    [getTimeFromPosition, onSeek, isDraggingPlayhead, isDraggingTrimHandle]
  );

  // Handle playhead drag
  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDraggingPlayhead(true);
    },
    [setIsDraggingPlayhead]
  );

  // Handle trim handle drag
  const handleTrimHandleMouseDown = useCallback(
    (e: React.MouseEvent, handle: "start" | "end") => {
      e.stopPropagation();
      setIsDraggingTrimHandle(handle);
    },
    [setIsDraggingTrimHandle]
  );

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead) {
        const time = getTimeFromPosition(e.clientX);
        // Constrain to trim region
        const constrainedTime = Math.max(trimState.startTime, Math.min(trimState.endTime, time));
        onSeek(constrainedTime);
      } else if (isDraggingTrimHandle) {
        const time = getTimeFromPosition(e.clientX);
        if (isDraggingTrimHandle === "start") {
          const newStart = Math.max(0, Math.min(trimState.endTime - 0.5, time));
          setTrimState((prev) => ({ ...prev, startTime: newStart }));
        } else {
          const newEnd = Math.min(duration, Math.max(trimState.startTime + 0.5, time));
          setTrimState((prev) => ({ ...prev, endTime: newEnd }));
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setIsDraggingTrimHandle(null);
    };

    if (isDraggingPlayhead || isDraggingTrimHandle) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDraggingPlayhead,
    isDraggingTrimHandle,
    getTimeFromPosition,
    onSeek,
    trimState,
    duration,
    setTrimState,
    setIsDraggingPlayhead,
    setIsDraggingTrimHandle,
  ]);

  return (
    <div className="bg-surface-base border border-border-base rounded-xl p-4">
      {/* Time Labels */}
      <div className="flex justify-between text-xs text-text-tertiary mb-2">
        <span>{formatTime(0)}</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Video Track */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1 text-xs text-text-tertiary w-16">
          <Icon icon="solar:videocamera-bold" className="text-sm" />
          <span>Video</span>
        </div>
        <div
          ref={timelineRef}
          className="relative flex-1 h-12 rounded-lg overflow-hidden bg-surface-elevated cursor-pointer select-none"
          onClick={handleTimelineClick}
        >
          {/* Thumbnails */}
          <div className="absolute inset-0 flex">
            {isGeneratingThumbnails ? (
              <div className="flex-1 flex items-center justify-center">
                <Icon
                  icon="solar:refresh-circle-bold-duotone"
                  className="text-xl text-text-tertiary animate-spin"
                />
              </div>
            ) : thumbnails.length > 0 ? (
              thumbnails.map((thumb, i) => (
                <div
                  key={i}
                  className="h-full flex-shrink-0"
                  style={{
                    width: `${100 / thumbnails.length}%`,
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

          {/* Darkening overlay for non-trimmed regions */}
          <div
            className="absolute top-0 bottom-0 bg-black/70 pointer-events-none"
            style={{ left: 0, width: `${trimStartPercent}%` }}
          />
          <div
            className="absolute top-0 bottom-0 bg-black/70 pointer-events-none"
            style={{ left: `${trimEndPercent}%`, right: 0 }}
          />

          {/* Trim Region Border */}
          <div
            className="absolute top-0 bottom-0 border-2 border-accent-400 pointer-events-none"
            style={{ left: `${trimStartPercent}%`, width: `${trimEndPercent - trimStartPercent}%` }}
          />

          {/* Start Trim Handle */}
          <div
            className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-20"
            style={{ left: `calc(${trimStartPercent}% - 8px)` }}
            onMouseDown={(e) => handleTrimHandleMouseDown(e, "start")}
          >
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-accent-400 group-hover:w-1.5 transition-all" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 rounded bg-accent-400 flex items-center justify-center">
              <div className="w-0.5 h-3 bg-white/50 rounded-full" />
            </div>
          </div>

          {/* End Trim Handle */}
          <div
            className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-20"
            style={{ left: `calc(${trimEndPercent}% - 8px)` }}
            onMouseDown={(e) => handleTrimHandleMouseDown(e, "end")}
          >
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-accent-400 group-hover:w-1.5 transition-all" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 rounded bg-accent-400 flex items-center justify-center">
              <div className="w-0.5 h-3 bg-white/50 rounded-full" />
            </div>
          </div>

          {/* Playhead */}
          <div
            className={`absolute top-0 bottom-0 w-4 z-30 cursor-ew-resize group flex justify-center ${
              isDraggingPlayhead ? "cursor-grabbing" : ""
            }`}
            style={{ left: `calc(${playheadPercent}% - 8px)` }}
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="w-0.5 h-full bg-white group-hover:w-1 transition-all" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </div>

      {/* Audio Track */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-text-tertiary w-16">
          <Icon icon="solar:music-note-bold" className="text-sm" />
          <span>Audio</span>
        </div>
        <div className="relative flex-1 h-8 rounded-lg overflow-hidden bg-surface-elevated">
          {/* WaveSurfer Waveform */}
          <div
            ref={waveformRef}
            className="absolute inset-0"
            style={{ opacity: waveformReady ? 1 : 0 }}
          />

          {/* Loading state */}
          {waveformLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon
                icon="solar:refresh-circle-bold-duotone"
                className="text-sm text-text-tertiary animate-spin"
              />
            </div>
          )}

          {/* No audio fallback */}
          {!waveformLoading && !waveformReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs text-text-tertiary">Loading audio...</span>
            </div>
          )}

          {/* Muted indicator */}
          {audioState.originalMuted && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Icon icon="solar:volume-cross-bold" className="text-red-500" />
            </div>
          )}

          {/* Darkening overlay for non-trimmed regions */}
          <div
            className="absolute top-0 bottom-0 bg-black/50 pointer-events-none z-5"
            style={{ left: 0, width: `${trimStartPercent}%` }}
          />
          <div
            className="absolute top-0 bottom-0 bg-black/50 pointer-events-none z-5"
            style={{ left: `${trimEndPercent}%`, right: 0 }}
          />

          {/* Volume indicator */}
          <div className="absolute bottom-0.5 right-1 flex items-center gap-1 text-[10px] text-text-tertiary bg-black/40 px-1 rounded z-10">
            <Icon icon="solar:volume-loud-bold" className="text-xs" />
            <span>{Math.round(audioState.originalVolume * 100)}%</span>
          </div>

          {/* Playhead line extension */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none z-10"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>
      </div>

      {/* Trim Info */}
      <div className="flex justify-between items-center mt-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-text-tertiary">In:</span>
          <span className="text-text-primary font-mono bg-surface-elevated px-2 py-0.5 rounded">
            {formatTime(trimState.startTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="solar:scissors-bold" className="text-accent-400" />
          <span className="text-text-secondary">
            Duration: {formatTime(trimState.endTime - trimState.startTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-tertiary">Out:</span>
          <span className="text-text-primary font-mono bg-surface-elevated px-2 py-0.5 rounded">
            {formatTime(trimState.endTime)}
          </span>
        </div>
      </div>
    </div>
  );
}
