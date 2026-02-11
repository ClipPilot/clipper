"use client";

import React, { useRef, useCallback, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Icon } from "@iconify/react";
import WaveSurfer from "wavesurfer.js";
import { useSetAtom } from "jotai";
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
  // Segment atoms
  activeSegmentsAtom,
  segmentsStateAtom,
  splitSegmentAtom,
  deleteSegmentAtom,
  selectSegmentAtom,
  trimSegmentAtom,
  moveSegmentAtom,
  commitSegmentMoveAtom,
  reorderSegmentsAtom,
  undoSegmentsAtom,
  redoSegmentsAtom,
  canUndoAtom,
  canRedoAtom,
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

  // Segment atoms
  const activeSegments = useAtomValue(activeSegmentsAtom);
  const [segmentsState] = useAtom(segmentsStateAtom);
  const splitSegment = useSetAtom(splitSegmentAtom);
  const deleteSegment = useSetAtom(deleteSegmentAtom);
  const selectSegment = useSetAtom(selectSegmentAtom);
  const trimSegment = useSetAtom(trimSegmentAtom);
  const moveSegment = useSetAtom(moveSegmentAtom);
  const commitSegmentMove = useSetAtom(commitSegmentMoveAtom);
  const reorderSegments = useSetAtom(reorderSegmentsAtom);
  const undoSegments = useSetAtom(undoSegmentsAtom);
  const redoSegments = useSetAtom(redoSegmentsAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const selectedSegmentId = segmentsState.selectedSegmentId;

  // State for dragging segment handles
  const [draggingSegmentHandle, setDraggingSegmentHandle] = useState<{
    segmentId: string;
    handle: "start" | "end";
  } | null>(null);

  // State for dragging entire segment (move/reorder)
  const [draggingSegment, setDraggingSegment] = useState<{
    segmentId: string;
    startX: number;
    originalStartTime: number;
    hasMoved: boolean;
  } | null>(null);

  // Track potential drop target for reordering
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

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

  // Check if split is possible at current time
  const canSplit = activeSegments.some(
    (s) => currentTime > s.startTime + 0.5 && currentTime < s.endTime - 0.5
  );

  // Handle split at playhead
  const handleSplit = useCallback(() => {
    if (canSplit) {
      splitSegment(currentTime);
    }
  }, [canSplit, splitSegment, currentTime]);

  // Handle segment click
  const handleSegmentClick = useCallback(
    (e: React.MouseEvent, segmentId: string) => {
      e.stopPropagation();
      selectSegment(segmentId);
    },
    [selectSegment]
  );

  // Handle segment handle drag start
  const handleSegmentHandleMouseDown = useCallback(
    (e: React.MouseEvent, segmentId: string, handle: "start" | "end") => {
      e.stopPropagation();
      setDraggingSegmentHandle({ segmentId, handle });
    },
    []
  );

  // Handle segment body drag start (for moving/reordering)
  const handleSegmentDragStart = useCallback(
    (e: React.MouseEvent, segmentId: string) => {
      e.stopPropagation();
      const segment = activeSegments.find((s) => s.id === segmentId);
      if (!segment) return;

      // Select the segment
      selectSegment(segmentId);

      setDraggingSegment({
        segmentId,
        startX: e.clientX,
        originalStartTime: segment.startTime,
        hasMoved: false,
      });
    },
    [activeSegments, selectSegment]
  );

  // Segment handle drag effect
  useEffect(() => {
    if (!draggingSegmentHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      const segment = activeSegments.find((s) => s.id === draggingSegmentHandle.segmentId);
      if (!segment) return;

      if (draggingSegmentHandle.handle === "start") {
        // Ensure new start is valid
        const newStart = Math.max(0, Math.min(segment.endTime - 0.5, time));
        trimSegment({ segmentId: segment.id, startTime: newStart });
      } else {
        // Ensure new end is valid
        const newEnd = Math.min(duration, Math.max(segment.startTime + 0.5, time));
        trimSegment({ segmentId: segment.id, endTime: newEnd });
      }
    };

    const handleMouseUp = () => {
      setDraggingSegmentHandle(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingSegmentHandle, getTimeFromPosition, activeSegments, trimSegment, duration]);

  // Segment body drag effect (for moving/reordering)
  useEffect(() => {
    if (!draggingSegment || !timelineRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current!.getBoundingClientRect();
      const deltaX = e.clientX - draggingSegment.startX;
      const deltaPercent = deltaX / rect.width;
      const deltaTime = deltaPercent * duration;

      // Calculate new start time
      const newStartTime = draggingSegment.originalStartTime + deltaTime;

      // Move the segment
      moveSegment({ segmentId: draggingSegment.segmentId, newStartTime });

      // Mark as moved if delta is significant
      if (Math.abs(deltaX) > 5 && !draggingSegment.hasMoved) {
        setDraggingSegment((prev) => prev ? { ...prev, hasMoved: true } : null);
      }

      // Check for reorder (when segment center crosses another segment's center)
      const segment = activeSegments.find((s) => s.id === draggingSegment.segmentId);
      if (segment) {
        const segmentCenter = (newStartTime + newStartTime + (segment.endTime - segment.startTime)) / 2;
        const currentIndex = activeSegments.findIndex((s) => s.id === draggingSegment.segmentId);

        // Find potential drop target
        let newDropTarget: number | null = null;
        for (let i = 0; i < activeSegments.length; i++) {
          if (i === currentIndex) continue;
          const otherSegment = activeSegments[i];
          const otherCenter = (otherSegment.startTime + otherSegment.endTime) / 2;

          if (segmentCenter < otherCenter && i < currentIndex) {
            newDropTarget = i;
            break;
          } else if (segmentCenter > otherCenter && i > currentIndex) {
            newDropTarget = i;
          }
        }
        setDropTargetIndex(newDropTarget);
      }
    };

    const handleMouseUp = () => {
      // If there's a drop target and we've moved, reorder
      if (dropTargetIndex !== null && draggingSegment.hasMoved) {
        const currentIndex = activeSegments.findIndex((s) => s.id === draggingSegment.segmentId);
        if (currentIndex !== -1 && currentIndex !== dropTargetIndex) {
          reorderSegments({ fromIndex: currentIndex, toIndex: dropTargetIndex });
        }
      }

      // Save to history if moved
      if (draggingSegment.hasMoved) {
        commitSegmentMove();
      }

      setDraggingSegment(null);
      setDropTargetIndex(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingSegment, activeSegments, duration, moveSegment, commitSegmentMove, reorderSegments, dropTargetIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undoSegments();
        return;
      }

      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redoSegments();
        return;
      }

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSplit();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedSegmentId) {
          e.preventDefault();
          deleteSegment();
        }
      }
      if (e.key === "Escape") {
        selectSegment(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSplit, selectedSegmentId, deleteSegment, selectSegment, canUndo, canRedo, undoSegments, redoSegments]);

  return (
    <div className="bg-surface-base border border-border-base rounded-xl p-4">
      {/* Time Labels */}
      <div className="flex justify-between text-xs text-text-tertiary mb-2">
        <span>{formatTime(0)}</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Video Track */}
      <div className="relative flex items-center gap-2 mb-2 pt-6">
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

          {/* Segment Selection Overlays */}
          {activeSegments.map((segment, index) => {
            const isSelected = segment.id === selectedSegmentId;
            const isDragging = draggingSegment?.segmentId === segment.id;
            const isDropTarget = dropTargetIndex === index;
            const startPercent = duration > 0 ? (segment.startTime / duration) * 100 : 0;
            const endPercent = duration > 0 ? (segment.endTime / duration) * 100 : 0;
            const widthPercent = endPercent - startPercent;

            return (
              <div
                key={`segment-${segment.id}`}
                className={`absolute top-0 bottom-0 transition-all z-10 ${
                  isDragging
                    ? "opacity-70 ring-2 ring-white z-40 cursor-grabbing"
                    : isSelected
                    ? "ring-2 ring-accent-400 ring-inset bg-accent-400/20 cursor-grab"
                    : "cursor-pointer hover:bg-white/10"
                } ${isDropTarget ? "ring-2 ring-primary-400" : ""}`}
                style={{
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                }}
                onClick={(e) => {
                  // Only handle click if not dragging
                  if (!draggingSegment?.hasMoved) {
                    handleSegmentClick(e, segment.id);
                  }
                }}
                onMouseDown={(e) => {
                  // Only start drag from segment body, not handles
                  if ((e.target as HTMLElement).closest('[data-handle]')) return;
                  handleSegmentDragStart(e, segment.id);
                }}
              >
                {/* Speed indicator badge */}
                {segment.speed !== 1.0 && (
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
                    <Icon icon="solar:speedometer-bold" className="text-[8px]" />
                    {segment.speed}x
                  </div>
                )}

                {/* Drag indicator when dragging */}
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Icon icon="solar:move-bold" className="text-white text-lg drop-shadow-lg" />
                  </div>
                )}

                {/* Segment trim handles - only show when selected and not dragging */}
                {isSelected && !isDragging && (
                  <>
                    {/* Start handle - positioned at exact start edge */}
                    <div
                      data-handle="start"
                      className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-30"
                      style={{ left: '-8px' }}
                      onMouseDown={(e) => handleSegmentHandleMouseDown(e, segment.id, "start")}
                    >
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-accent-400 group-hover:w-1.5 transition-all" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-5 rounded bg-accent-400 flex items-center justify-center">
                        <div className="w-0.5 h-2.5 bg-white/50 rounded-full" />
                      </div>
                    </div>
                    {/* End handle - positioned at exact end edge */}
                    <div
                      data-handle="end"
                      className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-30"
                      style={{ right: '-8px' }}
                      onMouseDown={(e) => handleSegmentHandleMouseDown(e, segment.id, "end")}
                    >
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-accent-400 group-hover:w-1.5 transition-all" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-5 rounded bg-accent-400 flex items-center justify-center">
                        <div className="w-0.5 h-2.5 bg-white/50 rounded-full" />
                      </div>
                    </div>
                  </>
                )}

                {/* Drop indicator line */}
                {isDropTarget && (
                  <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-primary-400 shadow-lg shadow-primary-400/50" />
                )}
              </div>
            );
          })}

          {/* Segment Boundaries */}
          {activeSegments.map((segment, index) => {
            if (index === 0) return null; // No boundary before first segment
            const boundaryPercent = duration > 0 ? (segment.startTime / duration) * 100 : 0;

            return (
              <div
                key={`boundary-${segment.id}`}
                className="absolute top-0 bottom-0 w-1 bg-white/80 z-25 pointer-events-none"
                style={{ left: `${boundaryPercent}%`, transform: "translateX(-50%)" }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-6 bg-white rounded-sm shadow-lg" />
              </div>
            );
          })}

          {/* Darkening overlay for non-trimmed regions (legacy - uses first and last segment bounds) */}
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

          {/* Split Button - positioned directly above playhead */}
          {canSplit && (
            <button
              onClick={handleSplit}
              className="absolute -top-6 w-5 h-5 rounded-full bg-accent-400 hover:bg-accent-500 flex items-center justify-center shadow-lg transition-colors z-40"
              style={{ left: `calc(${playheadPercent}% - 10px)` }}
              title="Split at playhead (S)"
            >
              <Icon icon="solar:scissors-bold" className="text-white text-xs" />
            </button>
          )}
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

      {/* Segment Info & Keyboard Shortcuts */}
      {activeSegments.length > 0 && (
        <div className="flex justify-between items-center mt-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-text-tertiary">
              {activeSegments.length} segment{activeSegments.length !== 1 ? "s" : ""}
            </span>
            {selectedSegmentId && (
              <span className="text-accent-400">
                Selected: {formatTime(activeSegments.find((s) => s.id === selectedSegmentId)?.startTime || 0)} -{" "}
                {formatTime(activeSegments.find((s) => s.id === selectedSegmentId)?.endTime || 0)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-text-tertiary">
            <span>
              <kbd className="px-1 py-0.5 bg-surface-elevated rounded text-[10px]">S</kbd> Split
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface-elevated rounded text-[10px]">Del</kbd> Cut
            </span>
            <span className={canUndo ? "" : "opacity-50"}>
              <kbd className="px-1 py-0.5 bg-surface-elevated rounded text-[10px]">⌘Z</kbd> Undo
            </span>
            <span className={canRedo ? "" : "opacity-50"}>
              <kbd className="px-1 py-0.5 bg-surface-elevated rounded text-[10px]">⌘⇧Z</kbd> Redo
            </span>
            <span className="hidden sm:inline">
              <Icon icon="solar:cursor-bold" className="inline text-xs mr-0.5" /> Drag to move
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
