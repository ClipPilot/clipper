"use client";

import React, { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Icon } from "@iconify/react";
import { Timeline, TimelineState } from "@xzdarcy/react-timeline-editor";
import type { TimelineRow, TimelineAction, TimelineEffect } from "@xzdarcy/timeline-engine";
import {
  videoDurationAtom,
  currentTimeAtom,
  trimStateAtom,
  thumbnailsAtom,
  isGeneratingThumbnailsAtom,
  audioStateAtom,
  editorClipAtom,
  activeSegmentsAtom,
  segmentsStateAtom,
  splitSegmentAtom,
  deleteSegmentAtom,
  selectSegmentAtom,
  undoSegmentsAtom,
  redoSegmentsAtom,
  canUndoAtom,
  canRedoAtom,
  Segment,
  generateSegmentId,
  segmentHistoryAtom,
  segmentHistoryIndexAtom,
  mediaOverlaysAtom,
  selectedOverlayIdAtom,
  MediaOverlay,
} from "@/store/videoEditor";

interface EditorTimelineV2Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSeek: (time: number) => void;
}

// Custom action type with segment data
interface SegmentAction extends TimelineAction {
  segmentData: Segment;
}

export function EditorTimelineV2({ videoRef, onSeek }: EditorTimelineV2Props) {
  const timelineRef = useRef<TimelineState>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCursor, setIsDraggingCursor] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit-to-view

  // Atoms
  const duration = useAtomValue(videoDurationAtom);
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom);
  const [trimState, setTrimState] = useAtom(trimStateAtom);
  const thumbnails = useAtomValue(thumbnailsAtom);
  const isGeneratingThumbnails = useAtomValue(isGeneratingThumbnailsAtom);
  const audioState = useAtomValue(audioStateAtom);
  const clip = useAtomValue(editorClipAtom);

  // Segment atoms
  const activeSegments = useAtomValue(activeSegmentsAtom);
  const [segmentsState, setSegmentsState] = useAtom(segmentsStateAtom);
  const splitSegment = useSetAtom(splitSegmentAtom);
  const deleteSegment = useSetAtom(deleteSegmentAtom);
  const selectSegment = useSetAtom(selectSegmentAtom);
  const undoSegments = useSetAtom(undoSegmentsAtom);
  const redoSegments = useSetAtom(redoSegmentsAtom);
  const canUndo = useAtomValue(canUndoAtom);
  const canRedo = useAtomValue(canRedoAtom);
  const selectedSegmentId = segmentsState.selectedSegmentId;

  // History atoms for manual history management
  const [segmentHistory, setSegmentHistory] = useAtom(segmentHistoryAtom);
  const [segmentHistoryIndex, setSegmentHistoryIndex] = useAtom(segmentHistoryIndexAtom);

  // Overlay atoms
  const overlays = useAtomValue(mediaOverlaysAtom);
  const [selectedOverlayId, setSelectedOverlayId] = useAtom(selectedOverlayIdAtom);
  const setOverlays = useSetAtom(mediaOverlaysAtom);

  // Generate smooth waveform SVG path from deterministic sample points
  const audioWavePath = useMemo(() => {
    const points = 80;
    const heights = Array.from({ length: points }, (_, i) =>
      0.2 + Math.abs(Math.sin(i * 0.7)) * 0.4 + Math.abs(Math.cos(i * 1.3)) * 0.3
    );
    // Build mirrored waveform path (top half + bottom half)
    const w = 100; // viewBox width percentage
    const midY = 50;
    const stepX = w / (points - 1);

    let topPath = `M 0 ${midY}`;
    let bottomPath = "";
    for (let i = 0; i < points; i++) {
      const x = i * stepX;
      const amp = heights[i] * midY * 0.85;
      topPath += ` L ${x} ${midY - amp}`;
    }
    // Come back along the bottom
    for (let i = points - 1; i >= 0; i--) {
      const x = i * stepX;
      const amp = heights[i] * midY * 0.85;
      bottomPath += ` L ${x} ${midY + amp}`;
    }
    return topPath + bottomPath + " Z";
  }, []);

  // Convert segments to timeline editor format
  const editorData: TimelineRow[] = useMemo(() => {
    const videoActions: SegmentAction[] = activeSegments.map((segment) => ({
      id: segment.id,
      start: segment.startTime,
      end: segment.endTime,
      effectId: "segment",
      selected: segment.id === selectedSegmentId,
      flexible: true,
      movable: true,
      segmentData: segment,
    }));

    // Audio track mirrors video segments (non-interactive)
    const audioActions: TimelineAction[] = activeSegments.map((segment) => ({
      id: `audio-${segment.id}`,
      start: segment.startTime,
      end: segment.endTime,
      effectId: "audio",
      flexible: false,
      movable: false,
    }));

    const rows: TimelineRow[] = [
      {
        id: "video-track",
        actions: videoActions,
        rowHeight: 60,
      },
    ];

    // Add overlay track if overlays exist
    if (overlays.length > 0) {
      const overlayActions: TimelineAction[] = overlays.map((overlay) => ({
        id: overlay.id,
        start: overlay.startTime,
        end: overlay.endTime,
        effectId: "overlay",
        flexible: true,
        movable: true,
      }));
      rows.push({
        id: "overlay-track",
        actions: overlayActions,
        rowHeight: 36,
      });
    }

    rows.push({
      id: "audio-track",
      actions: audioActions,
      rowHeight: 36,
    });

    return rows;
  }, [activeSegments, selectedSegmentId, overlays]);

  // Define effects
  const effects: Record<string, TimelineEffect> = useMemo(
    () => ({
      segment: {
        id: "segment",
        name: "Video Segment",
      },
      audio: {
        id: "audio",
        name: "Audio",
      },
      overlay: {
        id: "overlay",
        name: "Overlay",
      },
    }),
    []
  );

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

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

  // Save to history helper
  const saveToHistory = useCallback(() => {
    const newHistory = segmentHistory.slice(0, segmentHistoryIndex + 1);
    newHistory.push([...activeSegments]);
    if (newHistory.length > 50) newHistory.shift();
    setSegmentHistory(newHistory);
    setSegmentHistoryIndex(newHistory.length - 1);
  }, [segmentHistory, segmentHistoryIndex, activeSegments, setSegmentHistory, setSegmentHistoryIndex]);

  // Handle timeline data change (from drag/resize)
  const handleChange = useCallback(
    (newEditorData: TimelineRow[]) => {
      const videoTrack = newEditorData.find((row) => row.id === "video-track");
      if (!videoTrack) return;

      // Convert actions back to segments
      const newSegments: Segment[] = videoTrack.actions.map((action) => {
        const segmentAction = action as SegmentAction;
        return {
          id: action.id,
          startTime: action.start,
          endTime: action.end,
          speed: segmentAction.segmentData?.speed ?? 1.0,
        };
      });

      // Update segments state
      setSegmentsState({
        segments: newSegments,
        selectedSegmentId: segmentsState.selectedSegmentId,
      });

      // Update trim state to match overall bounds
      if (newSegments.length > 0) {
        const firstStart = Math.min(...newSegments.map((s) => s.startTime));
        const lastEnd = Math.max(...newSegments.map((s) => s.endTime));
        setTrimState({ startTime: firstStart, endTime: lastEnd });
      }

      // Update overlay times if overlay track was modified
      const overlayTrack = newEditorData.find((row) => row.id === "overlay-track");
      if (overlayTrack) {
        setOverlays((prev) =>
          prev.map((overlay) => {
            const action = overlayTrack.actions.find((a: any) => a.id === overlay.id);
            if (action) {
              return { ...overlay, startTime: action.start, endTime: action.end };
            }
            return overlay;
          })
        );
      }
    },
    [setSegmentsState, segmentsState.selectedSegmentId, setTrimState, setOverlays]
  );

  // Handle action click (select segment — ignore audio track)
  const handleClickAction = useCallback(
    (
      e: React.MouseEvent<HTMLElement, MouseEvent>,
      { action, row }: { action: TimelineAction; row: TimelineRow; time: number }
    ) => {
      if (row.id === "audio-track") return;
      e.stopPropagation();

      if (row.id === "overlay-track") {
        setSelectedOverlayId(action.id);
        selectSegment(null);
      } else {
        selectSegment(action.id);
        setSelectedOverlayId(null);
      }
    },
    [selectSegment, setSelectedOverlayId]
  );

  // Handle row click (deselect)
  const handleClickRow = useCallback(
    (
      e: React.MouseEvent<HTMLElement, MouseEvent>,
      { time }: { row: TimelineRow; time: number }
    ) => {
      selectSegment(null);
      onSeek(time);
    },
    [selectSegment, onSeek]
  );

  // Handle cursor drag
  const handleCursorDrag = useCallback(
    (time: number) => {
      setCurrentTime(time);
      onSeek(time);
    },
    [setCurrentTime, onSeek]
  );

  // Handle cursor drag start
  const handleCursorDragStart = useCallback(() => {
    setIsDraggingCursor(true);
  }, []);

  // Handle cursor drag end
  const handleCursorDragEnd = useCallback(
    (time: number) => {
      setIsDraggingCursor(false);
      setCurrentTime(time);
      onSeek(time);
    },
    [setCurrentTime, onSeek]
  );

  // Handle resize/move start - save to history
  const handleActionMoveStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  const handleActionResizeStart = useCallback(() => {
    saveToHistory();
  }, [saveToHistory]);

  // Handle time area click
  const handleClickTimeArea = useCallback(
    (time: number) => {
      onSeek(time);
      setCurrentTime(time);
      return true;
    },
    [onSeek, setCurrentTime]
  );

  // Sync timeline cursor with video playback
  useEffect(() => {
    if (timelineRef.current && !isDraggingCursor) {
      timelineRef.current.setTime(currentTime);
    }
  }, [currentTime, isDraggingCursor]);

  // Measure container width so timeline fills the card
  useEffect(() => {
    const el = timelineContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Calculate scaleWidth so the full duration fits in the visible area
  // scaleWidth = pixels per 1-second scale unit. startLeft is the left gutter.
  const startLeft = 20;
  const baseScaleWidth = useMemo(() => {
    if (!containerWidth || !duration) return 100;
    const availableWidth = containerWidth - startLeft;
    const perSecond = availableWidth / Math.ceil(duration);
    return Math.max(perSecond, 30);
  }, [containerWidth, duration]);

  const scaleWidth = baseScaleWidth * zoomLevel;

  // Reduce tick subdivisions when zoomed out to prevent label overlap
  const scaleSplitCount = useMemo(() => {
    if (scaleWidth >= 120) return 10;
    if (scaleWidth >= 60) return 5;
    if (scaleWidth >= 30) return 2;
    return 1;
  }, [scaleWidth]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(z * 1.5, 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(z / 1.5, 1));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Custom action renderer
  const getActionRender = useCallback(
    (action: TimelineAction, row: TimelineRow) => {
      // Overlay track renderer
      if (row.id === "overlay-track") {
        const overlay = overlays.find((o) => o.id === action.id);
        const isSelected = action.id === selectedOverlayId;
        return (
          <div
            className={`h-full w-full rounded flex items-center gap-1.5 px-2 ${
              isSelected
                ? "bg-purple-500/40 ring-1 ring-purple-400"
                : "bg-purple-500/20 hover:bg-purple-500/30"
            }`}
          >
            <Icon
              icon={overlay?.type === "video" ? "solar:videocamera-bold" : "solar:gallery-bold"}
              className="text-xs text-purple-400 shrink-0"
            />
            <span className="text-[10px] text-purple-300 truncate">
              {overlay?.fileName || "Overlay"}
            </span>
          </div>
        );
      }

      // Audio track renderer
      if (row.id === "audio-track") {
        const isMuted = audioState.originalMuted;
        return (
          <div
            className={`h-full w-full rounded flex items-center overflow-hidden ${
              isMuted ? "bg-surface-elevated/40" : "bg-sky-500/10"
            }`}
          >
            <Icon
              icon={isMuted ? "solar:muted-bold" : "solar:music-notes-bold"}
              className={`text-xs shrink-0 ml-1.5 z-10 ${isMuted ? "text-text-tertiary" : "text-sky-400"}`}
            />
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="flex-1 h-full"
            >
              <path
                d={audioWavePath}
                fill={isMuted ? "rgba(120,120,120,0.15)" : "rgba(56,189,248,0.35)"}
                stroke={isMuted ? "rgba(120,120,120,0.2)" : "rgba(56,189,248,0.5)"}
                strokeWidth="0.5"
              />
            </svg>
          </div>
        );
      }

      // Video segment renderer
      const segmentAction = action as SegmentAction;
      const isSelected = action.id === selectedSegmentId;
      const segment = segmentAction.segmentData;

      // Calculate which thumbnails fall in this segment's range
      const startIdx = Math.floor((action.start / duration) * thumbnails.length);
      const endIdx = Math.ceil((action.end / duration) * thumbnails.length);
      const segmentThumbs = thumbnails.slice(startIdx, Math.max(endIdx, startIdx + 1));

      return (
        <div
          className={`h-full w-full relative overflow-hidden rounded-md ${
            isSelected
              ? "ring-2 ring-accent-400 shadow-[0_0_8px_rgba(79,71,230,0.4)]"
              : "ring-1 ring-white/10 hover:ring-white/25"
          }`}
          style={isSelected ? { background: "linear-gradient(to bottom, rgba(79,71,230,0.15), rgba(79,71,230,0.05))" } : undefined}
        >
          {/* Left/right edge handles for selected segment */}
          {isSelected && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-400 z-20 rounded-l-md" />
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-400 z-20 rounded-r-md" />
            </>
          )}

          {/* Thumbnail filmstrip or loading state */}
          {isGeneratingThumbnails && thumbnails.length === 0 ? (
            <div className="absolute inset-0 bg-surface-elevated flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-text-tertiary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[10px] text-text-tertiary">Loading frames...</span>
            </div>
          ) : thumbnails.length > 0 ? (
            <div className="absolute inset-0 flex opacity-70">
              {segmentThumbs.map((thumb, i) => (
                <div
                  key={i}
                  className="h-full flex-1 min-w-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${thumb})` }}
                />
              ))}
            </div>
          ) : null}

          {/* Speed indicator */}
          {segment?.speed !== 1.0 && (
            <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10">
              <Icon icon="solar:speedometer-bold" className="text-[8px]" />
              {segment.speed}x
            </div>
          )}

          {/* Segment time info */}
          <div className="absolute bottom-1 left-1 right-1 flex justify-between text-[9px] text-white/70 z-10">
            <span className="bg-black/50 px-1 rounded">{formatTime(action.start)}</span>
            <span className="bg-black/50 px-1 rounded">{formatTime(action.end)}</span>
          </div>
        </div>
      );
    },
    [selectedSegmentId, thumbnails, duration, audioState.originalMuted, audioWavePath, overlays, selectedOverlayId, isGeneratingThumbnails]
  );

  // Format scale label — shorter format when zoomed out to prevent overlap
  const formatScaleLabel = useCallback(
    (seconds: number): string => {
      if (scaleWidth < 60) {
        // Very compact: just seconds
        return `${Math.round(seconds)}s`;
      }
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
    [scaleWidth]
  );

  // Custom scale renderer
  const getScaleRender = useCallback(
    (scale: number) => {
      return (
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          {formatScaleLabel(scale)}
        </span>
      );
    },
    [formatScaleLabel]
  );

  return (
    <div className="bg-surface-base border border-border-base rounded-xl p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSplit}
            disabled={!canSplit}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              canSplit
                ? "bg-accent-400 hover:bg-accent-500 text-white"
                : "bg-surface-elevated text-text-tertiary cursor-not-allowed"
            }`}
            title="Split at playhead (S)"
          >
            <Icon icon="solar:scissors-bold" />
            Split
          </button>
          <button
            onClick={() => deleteSegment()}
            disabled={!selectedSegmentId || activeSegments.length <= 1}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedSegmentId && activeSegments.length > 1
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-surface-elevated text-text-tertiary cursor-not-allowed"
            }`}
            title="Delete selected (Del)"
          >
            <Icon icon="solar:trash-bin-trash-bold" />
            Delete
          </button>
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-r border-border-base pr-3">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className={`p-1.5 rounded-lg transition-colors ${
                zoomLevel > 1
                  ? "hover:bg-surface-elevated text-text-primary"
                  : "text-text-tertiary cursor-not-allowed"
              }`}
              title="Zoom out"
            >
              <Icon icon="solar:magnifer-zoom-out-bold" className="text-lg" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:bg-surface-elevated transition-colors font-mono min-w-[38px] text-center"
              title="Reset zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 10}
              className={`p-1.5 rounded-lg transition-colors ${
                zoomLevel < 10
                  ? "hover:bg-surface-elevated text-text-primary"
                  : "text-text-tertiary cursor-not-allowed"
              }`}
              title="Zoom in"
            >
              <Icon icon="solar:magnifer-zoom-in-bold" className="text-lg" />
            </button>
          </div>
          <button
            onClick={() => undoSegments()}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-colors ${
              canUndo
                ? "hover:bg-surface-elevated text-text-primary"
                : "text-text-tertiary cursor-not-allowed"
            }`}
            title="Undo (Cmd+Z)"
          >
            <Icon icon="solar:undo-left-bold" className="text-lg" />
          </button>
          <button
            onClick={() => redoSegments()}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-colors ${
              canRedo
                ? "hover:bg-surface-elevated text-text-primary"
                : "text-text-tertiary cursor-not-allowed"
            }`}
            title="Redo (Cmd+Shift+Z)"
          >
            <Icon icon="solar:undo-right-bold" className="text-lg" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div ref={timelineContainerRef} className="timeline-container rounded-lg overflow-x-auto overflow-y-hidden border border-border-base">
        <Timeline
          ref={timelineRef}
          editorData={editorData}
          effects={effects}
          scale={1}
          scaleWidth={scaleWidth}
          scaleSplitCount={scaleSplitCount}
          minScaleCount={Math.ceil(duration)}
          maxScaleCount={Math.ceil(duration) + 1}
          autoScroll={zoomLevel > 1}
          startLeft={startLeft}
          rowHeight={60}
          gridSnap={true}
          dragLine={true}
          onChange={handleChange}
          onClickAction={handleClickAction}
          onClickRow={handleClickRow}
          onClickTimeArea={handleClickTimeArea}
          onCursorDrag={handleCursorDrag}
          onCursorDragStart={handleCursorDragStart}
          onCursorDragEnd={handleCursorDragEnd}
          onActionMoveStart={handleActionMoveStart}
          onActionResizeStart={handleActionResizeStart}
          getActionRender={getActionRender}
          getScaleRender={getScaleRender}
          style={{ height: 176, width: "100%", backgroundColor: "var(--surface-elevated)" }}
        />
      </div>

      {/* Info Bar */}
      <div className="flex justify-between items-center mt-3 text-xs">
        <div className="flex items-center gap-4">
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
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="font-mono bg-surface-elevated px-2 py-0.5 rounded">
            {formatTime(currentTime)}
          </span>
          <span className="text-text-tertiary">/</span>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-text-tertiary">
        <span>
          <kbd className="px-1 py-0.5 bg-surface-elevated rounded">S</kbd> Split
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-surface-elevated rounded">Del</kbd> Delete
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-surface-elevated rounded">⌘Z</kbd> Undo
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-surface-elevated rounded">⌘⇧Z</kbd> Redo
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-surface-elevated rounded">Esc</kbd> Deselect
        </span>
      </div>
    </div>
  );
}
