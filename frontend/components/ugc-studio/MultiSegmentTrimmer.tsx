"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface VideoSegment {
  id: string;
  start: number;
  end: number;
}

interface MultiSegmentTrimmerProps {
  videoSrc: string;
  duration: number;
  segments: VideoSegment[];
  onSegmentsChange: (segments: VideoSegment[]) => void;
  maxTotalDuration?: number;
  maxSegments?: number;
}

const SEGMENT_COLORS = [
  { border: "border-accent-400", bg: "bg-accent-400", handle: "bg-accent-400" },
  { border: "border-purple-500", bg: "bg-purple-500", handle: "bg-purple-500" },
  { border: "border-green-500", bg: "bg-green-500", handle: "bg-green-500" },
];

export function MultiSegmentTrimmer({
  videoSrc,
  duration,
  segments,
  onSegmentsChange,
  maxTotalDuration = 30,
  maxSegments = 3,
}: MultiSegmentTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState<{
    segmentIndex: number;
    type: "start" | "end" | "segment";
  } | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartSegment, setDragStartSegment] = useState<VideoSegment | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const exceedsMax = totalDuration > maxTotalDuration + 0.01;

  useEffect(() => {
    if (!videoSrc || duration <= 0) return;

    const generateThumbnails = async () => {
      setIsGeneratingThumbnails(true);
      const video = document.createElement("video");
      video.src = videoSrc;
      video.crossOrigin = "anonymous";
      video.muted = true;

      await new Promise((resolve) => {
        video.onloadeddata = resolve;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const numThumbnails = Math.min(20, Math.ceil(duration / 2));
      const interval = duration / numThumbnails;
      const thumbs: string[] = [];

      canvas.width = 120;
      canvas.height = 68;

      for (let i = 0; i < numThumbnails; i++) {
        video.currentTime = i * interval;
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL("image/jpeg", 0.5));
      }

      setThumbnails(thumbs);
      setIsGeneratingThumbnails(false);
    };

    generateThumbnails();
  }, [videoSrc, duration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      const activeSegment = segments[activeSegmentIndex];
      if (activeSegment && time >= activeSegment.end) {
        const nextIndex = activeSegmentIndex + 1;
        if (nextIndex < segments.length) {
          setActiveSegmentIndex(nextIndex);
          video.currentTime = segments[nextIndex].start;
        } else {
          setActiveSegmentIndex(0);
          video.currentTime = segments[0].start;
          if (!isPlaying) video.pause();
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [segments, activeSegmentIndex, isPlaying]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video || segments.length === 0) return;

    if (isPlaying) {
      video.pause();
    } else {
      const activeSegment = segments[activeSegmentIndex];
      if (activeSegment) {
        if (video.currentTime < activeSegment.start || video.currentTime >= activeSegment.end) {
          video.currentTime = activeSegment.start;
        }
        video.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    segmentIndex: number,
    type: "start" | "end" | "segment"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging({ segmentIndex, type });
    setDragStartX(e.clientX);
    setDragStartSegment({ ...segments[segmentIndex] });
    setActiveSegmentIndex(segmentIndex);
  };

  const handleTimelineMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current || !dragStartSegment) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const { segmentIndex, type } = isDragging;
      const segment = segments[segmentIndex];
      const color = SEGMENT_COLORS[segmentIndex % SEGMENT_COLORS.length];

      if (type === "segment") {
        const deltaX = e.clientX - dragStartX;
        const deltaTime = (deltaX / rect.width) * duration;
        const segmentDuration = dragStartSegment.end - dragStartSegment.start;

        let newStart = dragStartSegment.start + deltaTime;
        let newEnd = dragStartSegment.end + deltaTime;

        if (newStart < 0) {
          newStart = 0;
          newEnd = segmentDuration;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - segmentDuration;
        }

        const otherSegments = segments.filter((_, i) => i !== segmentIndex);
        const hasOverlap = otherSegments.some(
          (s) => !(newEnd <= s.start || newStart >= s.end)
        );
        if (hasOverlap) return;

        const updated = [...segments];
        updated[segmentIndex] = { ...segment, start: newStart, end: newEnd };
        onSegmentsChange(updated);
      } else {
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const time = (x / rect.width) * duration;

        if (type === "start") {
          const newStart = Math.max(0, Math.min(time, segment.end - 0.5));
          const otherDuration = segments
            .filter((_, i) => i !== segmentIndex)
            .reduce((sum, s) => sum + (s.end - s.start), 0);
          const maxForThis = maxTotalDuration - otherDuration;
          const adjustedStart = Math.max(newStart, segment.end - maxForThis);

          const otherSegments = segments.filter((_, i) => i !== segmentIndex);
          const hasOverlap = otherSegments.some(
            (s) => !(segment.end <= s.start || adjustedStart >= s.end)
          );
          if (hasOverlap) return;

          const updated = [...segments];
          updated[segmentIndex] = { ...segment, start: adjustedStart };
          onSegmentsChange(updated);
        } else if (type === "end") {
          const newEnd = Math.max(segment.start + 0.5, Math.min(time, duration));
          const otherDuration = segments
            .filter((_, i) => i !== segmentIndex)
            .reduce((sum, s) => sum + (s.end - s.start), 0);
          const maxForThis = maxTotalDuration - otherDuration;
          const adjustedEnd = Math.min(newEnd, segment.start + maxForThis);

          const otherSegments = segments.filter((_, i) => i !== segmentIndex);
          const hasOverlap = otherSegments.some(
            (s) => !(adjustedEnd <= s.start || segment.start >= s.end)
          );
          if (hasOverlap) return;

          const updated = [...segments];
          updated[segmentIndex] = { ...segment, end: adjustedEnd };
          onSegmentsChange(updated);
        }
      }
    },
    [isDragging, duration, segments, maxTotalDuration, onSegmentsChange, dragStartX, dragStartSegment]
  );

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
    setDragStartSegment(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleTimelineMouseMove);
      window.addEventListener("mouseup", handleTimelineMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleTimelineMouseMove);
        window.removeEventListener("mouseup", handleTimelineMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleTimelineMouseUp]);

  const addSegment = () => {
    if (segments.length >= maxSegments) return;

    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    let newStart = 0;
    let newEnd = 0;
    const minDuration = 1;
    const desiredDuration = 5;

    const gaps: { start: number; end: number }[] = [];
    if (sortedSegments.length === 0) {
      gaps.push({ start: 0, end: duration });
    } else {
      if (sortedSegments[0].start > 0) {
        gaps.push({ start: 0, end: sortedSegments[0].start });
      }
      for (let i = 0; i < sortedSegments.length - 1; i++) {
        if (sortedSegments[i + 1].start > sortedSegments[i].end) {
          gaps.push({ start: sortedSegments[i].end, end: sortedSegments[i + 1].start });
        }
      }
      if (sortedSegments[sortedSegments.length - 1].end < duration) {
        gaps.push({ start: sortedSegments[sortedSegments.length - 1].end, end: duration });
      }
    }

    const remainingDuration = maxTotalDuration - totalDuration;
    const maxNewDuration = Math.min(remainingDuration, desiredDuration);

    for (const gap of gaps) {
      const gapSize = gap.end - gap.start;
      if (gapSize >= minDuration) {
        newStart = gap.start;
        newEnd = Math.min(gap.start + maxNewDuration, gap.end);
        break;
      }
    }

    if (newEnd - newStart < minDuration) return;

    const newSegment: VideoSegment = {
      id: crypto.randomUUID(),
      start: newStart,
      end: newEnd,
    };

    onSegmentsChange([...segments, newSegment]);
    setActiveSegmentIndex(segments.length);
  };

  const removeSegment = (index: number) => {
    if (segments.length <= 1) return;
    const updated = segments.filter((_, i) => i !== index);
    onSegmentsChange(updated);
    setActiveSegmentIndex(Math.min(activeSegmentIndex, updated.length - 1));
  };

  const playheadPercent = (currentTime / duration) * 100;

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        <button
          onClick={togglePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
        >
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Icon
              icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"}
              className="text-white text-2xl ml-1"
            />
          </div>
        </button>
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
          {formatTime(currentTime)}
        </div>
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
          {formatTime(duration)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs text-text-tertiary px-1">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div
          ref={timelineRef}
          className="relative h-16 rounded-lg overflow-hidden bg-surface-elevated cursor-pointer select-none"
        >
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

          <div className="absolute inset-0 bg-black/60" />

          {segments.map((segment, index) => {
            const startPercent = (segment.start / duration) * 100;
            const endPercent = (segment.end / duration) * 100;
            const widthPercent = endPercent - startPercent;
            const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
            const isActive = index === activeSegmentIndex;

            return (
              <div key={segment.id}>
                <div
                  className={`absolute top-0 bottom-0 ${color.border} border-y-2 cursor-grab active:cursor-grabbing ${isActive ? "z-10" : "z-5 opacity-70"}`}
                  style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                  onMouseDown={(e) => handleTimelineMouseDown(e, index, "segment")}
                >
                  <div className="absolute inset-0 bg-transparent" />
                </div>

                <div
                  className={`absolute top-0 bottom-0 w-4 cursor-ew-resize group ${isActive ? "z-20" : "z-15"}`}
                  style={{ left: `calc(${startPercent}% - 8px)` }}
                  onMouseDown={(e) => handleTimelineMouseDown(e, index, "start")}
                >
                  <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 ${color.handle} group-hover:w-1.5 transition-all`} />
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded ${color.handle} flex items-center justify-center`}>
                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                  </div>
                </div>

                <div
                  className={`absolute top-0 bottom-0 w-4 cursor-ew-resize group ${isActive ? "z-20" : "z-15"}`}
                  style={{ left: `calc(${endPercent}% - 8px)` }}
                  onMouseDown={(e) => handleTimelineMouseDown(e, index, "end")}
                >
                  <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 ${color.handle} group-hover:w-1.5 transition-all`} />
                  <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded ${color.handle} flex items-center justify-center`}>
                    <div className="w-0.5 h-4 bg-white/50 rounded-full" />
                  </div>
                </div>
              </div>
            );
          })}

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-30 pointer-events-none"
            style={{ left: `${playheadPercent}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {segments.map((segment, index) => {
            const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
            const segDuration = Math.round((segment.end - segment.start) * 10) / 10;
            const isActive = index === activeSegmentIndex;

            return (
              <div
                key={segment.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? `${color.border} bg-surface-elevated`
                    : "border-border-base hover:border-text-tertiary"
                }`}
                onClick={() => {
                  setActiveSegmentIndex(index);
                  if (videoRef.current) {
                    videoRef.current.currentTime = segment.start;
                    setCurrentTime(segment.start);
                  }
                }}
              >
                <div className={`w-2 h-2 rounded-full ${color.bg}`} />
                <span className="text-xs font-mono text-text-primary">
                  {formatTime(segment.start)} - {formatTime(segment.end)}
                </span>
                <span className="text-xs text-text-tertiary">({segDuration}s)</span>
                {segments.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSegment(index);
                    }}
                    className="ml-1 text-text-tertiary hover:text-red-500 transition-colors"
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
              variant="flat"
              className="bg-surface-elevated text-text-secondary"
              onPress={addSegment}
              startContent={<Icon icon="solar:add-circle-bold" width={16} />}
            >
              Add Segment
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-text-tertiary">
            {segments.length} segment{segments.length !== 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-sm">Total:</span>
            <span
              className={`font-mono text-sm font-medium ${
                exceedsMax ? "text-red-500" : "text-accent-400"
              }`}
            >
              {formatTime(totalDuration)}
            </span>
            <span className="text-text-muted text-xs">/ {maxTotalDuration}s max</span>
          </div>
        </div>

        {exceedsMax && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
            <Icon icon="solar:danger-circle-bold" width={16} />
            <span>Combined segment duration must be {maxTotalDuration} seconds or less</span>
          </div>
        )}
      </div>
    </div>
  );
}
