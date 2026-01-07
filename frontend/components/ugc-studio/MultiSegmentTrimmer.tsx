"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { apiFetch } from "@/lib/apiClient";
import API_URL from "@/config/constants";

export interface VideoSegment {
  id: string;
  start: number;
  end: number;
}

interface MultiSegmentTrimmerProps {
  videoSrc: string;
  videoFile?: File;
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

const FRAME_RATE = 30;
const FRAME_DURATION = 1 / FRAME_RATE;

export function MultiSegmentTrimmer({
  videoSrc,
  videoFile,
  duration,
  segments,
  onSegmentsChange,
  maxTotalDuration = 50,
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
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartSegment, setDragStartSegment] = useState<VideoSegment | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [startFramePreview, setStartFramePreview] = useState<string | null>(null);
  const [endFramePreview, setEndFramePreview] = useState<string | null>(null);
  const [isDetectingFaces, setIsDetectingFaces] = useState(false);

  const handleAutoDetectFaces = async () => {
    if (!videoFile || isDetectingFaces) return;

    setIsDetectingFaces(true);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);

      const response = await apiFetch(`${API_URL}/face-swap/detect-faces`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to detect faces");
      }

      const data = await response.json();

      if (data.segments && data.segments.length > 0) {
        // Limit to maxSegments and ensure total duration doesn't exceed max
        let selectedSegments: VideoSegment[] = [];
        let totalDuration = 0;

        for (const seg of data.segments) {
          if (selectedSegments.length >= maxSegments) break;

          const segDuration = seg.end - seg.start;
          if (totalDuration + segDuration <= maxTotalDuration) {
            selectedSegments.push({
              id: crypto.randomUUID(),
              start: seg.start,
              end: seg.end,
            });
            totalDuration += segDuration;
          } else if (totalDuration < maxTotalDuration) {
            // Truncate segment to fit
            const availableDuration = maxTotalDuration - totalDuration;
            if (availableDuration >= 0.5) {
              selectedSegments.push({
                id: crypto.randomUUID(),
                start: seg.start,
                end: seg.start + availableDuration,
              });
            }
            break;
          }
        }

        if (selectedSegments.length > 0) {
          onSegmentsChange(selectedSegments);
          setActiveSegmentIndex(0);

          addToast({
            title: "Faces detected!",
            description: `Found ${data.segmentCount} face segment${data.segmentCount !== 1 ? "s" : ""}, using ${selectedSegments.length}`,
            color: "success",
          });
        } else {
          addToast({
            title: "No usable segments",
            description: "Detected segments were too short. Try manual selection.",
            color: "warning",
          });
        }
      } else {
        addToast({
          title: "No faces detected",
          description: "Could not find clear face segments. Try manual selection.",
          color: "warning",
        });
      }
    } catch (error) {
      console.error("Face detection error:", error);
      addToast({
        title: "Detection failed",
        description: error instanceof Error ? error.message : "Failed to detect faces",
        color: "danger",
      });
    } finally {
      setIsDetectingFaces(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  const formatTimeWithFrames = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.round((seconds % 1) * FRAME_RATE);
    return `${mins}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}f`;
  };

  const captureFrameAt = useCallback(async (time: number): Promise<string | null> => {
    const video = videoRef.current;
    if (!video) return null;

    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      const videoWidth = video.videoWidth || 1920;
      const videoHeight = video.videoHeight || 1080;
      const scale = Math.min(640 / videoWidth, 640 / videoHeight);
      canvas.width = videoWidth * scale;
      canvas.height = videoHeight * scale;

      const handleSeeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        video.removeEventListener("seeked", handleSeeked);
        resolve(dataUrl);
      };

      video.addEventListener("seeked", handleSeeked);
      video.currentTime = time;
    });
  }, []);

  const updateFramePreviews = useCallback(async () => {
    const segment = segments[activeSegmentIndex];
    const video = videoRef.current;
    if (!segment || !video) {
      setStartFramePreview(null);
      setEndFramePreview(null);
      return;
    }

    const savedTime = video.currentTime;
    const startFrame = await captureFrameAt(segment.start);
    setStartFramePreview(startFrame);
    const endFrame = await captureFrameAt(segment.end - 0.001);
    setEndFramePreview(endFrame);
    video.currentTime = savedTime;
  }, [segments, activeSegmentIndex, captureFrameAt]);

  const adjustSegmentByFrames = (edge: "start" | "end", frames: number) => {
    const segment = segments[activeSegmentIndex];
    if (!segment) return;

    const delta = frames * FRAME_DURATION;
    const updated = [...segments];

    if (edge === "start") {
      const newStart = Math.max(0, Math.min(segment.start + delta, segment.end - FRAME_DURATION));
      const otherSegments = segments.filter((_, i) => i !== activeSegmentIndex);
      const hasOverlap = otherSegments.some((s) => !(segment.end <= s.start || newStart >= s.end));
      if (hasOverlap) return;
      updated[activeSegmentIndex] = { ...segment, start: newStart };
      // Seek video to show the new start frame
      if (videoRef.current) {
        videoRef.current.currentTime = newStart;
        setCurrentTime(newStart);
      }
    } else {
      const newEnd = Math.max(segment.start + FRAME_DURATION, Math.min(segment.end + delta, duration));
      const otherSegments = segments.filter((_, i) => i !== activeSegmentIndex);
      const hasOverlap = otherSegments.some((s) => !(newEnd <= s.start || segment.start >= s.end));
      if (hasOverlap) return;
      updated[activeSegmentIndex] = { ...segment, end: newEnd };
      // Seek video to show the new end frame
      if (videoRef.current) {
        videoRef.current.currentTime = newEnd - 0.001;
        setCurrentTime(newEnd - 0.001);
      }
    }

    onSegmentsChange(updated);
  };

  const seekToSegmentBoundary = (edge: "start" | "end") => {
    const segment = segments[activeSegmentIndex];
    if (!segment || !videoRef.current) return;

    const time = edge === "start" ? segment.start : segment.end - 0.001;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const stepFrame = (direction: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + direction * FRAME_DURATION, duration));
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
  };

  const seekToPosition = useCallback(
    (clientX: number) => {
      if (!timelineRef.current || !videoRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const time = (x / rect.width) * duration;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    },
    [duration]
  );

  const getCurrentSegmentIndex = (): number => {
    for (let i = 0; i < segments.length; i++) {
      if (currentTime >= segments[i].start && currentTime < segments[i].end) {
        return i;
      }
    }
    return -1;
  };

  const currentSegmentIndex = getCurrentSegmentIndex();
  const isInSegment = currentSegmentIndex !== -1;

  const playSegment = (index: number) => {
    const video = videoRef.current;
    const segment = segments[index];
    if (!video || !segment) return;

    setActiveSegmentIndex(index);
    video.currentTime = segment.start;
    video.play();
    setIsPlaying(true);
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

      if (!isPlaying || isDraggingPlayhead) return;

      const activeSegment = segments[activeSegmentIndex];
      if (activeSegment && time >= activeSegment.end) {
        const nextIndex = activeSegmentIndex + 1;
        if (nextIndex < segments.length) {
          setActiveSegmentIndex(nextIndex);
          video.currentTime = segments[nextIndex].start;
        } else {
          setActiveSegmentIndex(0);
          video.currentTime = segments[0].start;
          video.pause();
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [segments, activeSegmentIndex, isPlaying, isDraggingPlayhead]);

  // Update frame previews when active segment changes or segment boundaries change
  useEffect(() => {
    if (!videoRef.current || segments.length === 0) return;

    const segment = segments[activeSegmentIndex];
    if (!segment) return;

    // Debounce preview generation to avoid too many updates during dragging
    const timer = setTimeout(() => {
      updateFramePreviews();
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSegmentIndex, segments, updateFramePreviews]);

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
      if (isDraggingPlayhead) {
        seekToPosition(e.clientX);
        return;
      }

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

          // Seek video to show the start frame while dragging
          if (videoRef.current) {
            videoRef.current.currentTime = adjustedStart;
            setCurrentTime(adjustedStart);
          }
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

          // Seek video to show the end frame while dragging
          if (videoRef.current) {
            videoRef.current.currentTime = adjustedEnd;
            setCurrentTime(adjustedEnd);
          }
        }
      }
    },
    [isDragging, isDraggingPlayhead, seekToPosition, duration, segments, maxTotalDuration, onSegmentsChange, dragStartX, dragStartSegment, setCurrentTime]
  );

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
    setDragStartSegment(null);
    setIsDraggingPlayhead(false);
  }, []);

  useEffect(() => {
    if (isDragging || isDraggingPlayhead) {
      window.addEventListener("mousemove", handleTimelineMouseMove);
      window.addEventListener("mouseup", handleTimelineMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleTimelineMouseMove);
        window.removeEventListener("mouseup", handleTimelineMouseUp);
      };
    }
  }, [isDragging, isDraggingPlayhead, handleTimelineMouseMove, handleTimelineMouseUp]);

  const addSegment = () => {
    if (segments.length >= maxSegments) return;

    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    const minDuration = 1;
    const desiredDuration = 5;
    const remainingDuration = maxTotalDuration - totalDuration;
    const maxNewDuration = Math.min(remainingDuration, desiredDuration);

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

    let newStart = 0;
    let newEnd = 0;

    const playheadGap = gaps.find((g) => currentTime >= g.start && currentTime < g.end);
    if (playheadGap && playheadGap.end - currentTime >= minDuration) {
      newStart = currentTime;
      newEnd = Math.min(currentTime + maxNewDuration, playheadGap.end);
    } else {
      for (const gap of gaps) {
        const gapSize = gap.end - gap.start;
        if (gapSize >= minDuration) {
          newStart = gap.start;
          newEnd = Math.min(gap.start + maxNewDuration, gap.end);
          break;
        }
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
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <button
            onClick={() => stepFrame(-1)}
            className="w-7 h-7 rounded bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
            title="Previous frame"
          >
            <Icon icon="solar:rewind-back-bold" width={14} />
          </button>
          <button
            onClick={togglePlayPause}
            className="w-8 h-8 rounded bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
          >
            <Icon icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"} width={16} />
          </button>
          <button
            onClick={() => stepFrame(1)}
            className="w-7 h-7 rounded bg-black/70 hover:bg-black/90 flex items-center justify-center text-white transition-colors"
            title="Next frame"
          >
            <Icon icon="solar:rewind-forward-bold" width={14} />
          </button>
          <div className="px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
            {formatTimeWithFrames(currentTime)}
          </div>
          {isInSegment ? (
            <div className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${SEGMENT_COLORS[currentSegmentIndex % SEGMENT_COLORS.length].bg}`}>
              <Icon icon="solar:mask-happly-bold" width={12} />
              <span>Seg {currentSegmentIndex + 1}</span>
            </div>
          ) : (
            <div className="px-2 py-1 rounded bg-blue-500/80 text-white text-xs font-medium flex items-center gap-1">
              <Icon icon="solar:video-frame-bold" width={12} />
              <span>Original</span>
            </div>
          )}
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
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-timeline-bg]")) {
              seekToPosition(e.clientX);
            }
          }}
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

          <div className="absolute inset-0 bg-black/60" data-timeline-bg />

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

          {segments.length >= 2 &&
            (() => {
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
            })()}

          <div
            className={`absolute top-0 bottom-0 w-4 z-30 cursor-ew-resize group flex justify-center ${isDraggingPlayhead ? "cursor-grabbing" : ""}`}
            style={{ left: `calc(${playheadPercent}% - 8px)` }}
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="w-0.5 h-full bg-white group-hover:w-1 transition-all" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full shadow-lg group-hover:scale-110 transition-transform" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {segments.map((segment, index) => {
            const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
            const segDuration = Math.round((segment.end - segment.start) * 100) / 100;
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playSegment(index);
                  }}
                  className={`w-5 h-5 rounded-full ${color.bg} flex items-center justify-center hover:opacity-80 transition-opacity`}
                  title="Play this segment"
                >
                  <Icon icon="solar:play-bold" className="text-white" width={10} />
                </button>
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
              Add at Playhead
            </Button>
          )}

          {videoFile && (
            <Button
              size="sm"
              variant="flat"
              className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
              onPress={handleAutoDetectFaces}
              isLoading={isDetectingFaces}
              isDisabled={isDetectingFaces}
              startContent={!isDetectingFaces && <Icon icon="solar:face-scan-circle-bold" width={16} />}
            >
              {isDetectingFaces ? "Detecting..." : "Auto-detect Faces"}
            </Button>
          )}
        </div>

        {segments[activeSegmentIndex] && (
          <div className="p-3 bg-surface-elevated rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                Fine-tune Segment {activeSegmentIndex + 1}
              </span>
              <span className="text-[10px] text-text-tertiary">
                Duration: <span className="text-accent-400 font-medium">{formatTime(segments[activeSegmentIndex].end - segments[activeSegmentIndex].start)}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wide">Start (IN)</div>
                  <div className="font-mono text-[10px] text-text-primary">
                    {formatTime(segments[activeSegmentIndex].start)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => adjustSegmentByFrames("start", -10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <span className="text-[9px] font-medium">-10</span>
                  </button>
                  <button onClick={() => adjustSegmentByFrames("start", -1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <Icon icon="solar:alt-arrow-left-bold" width={12} />
                  </button>
                  <button onClick={() => seekToSegmentBoundary("start")} className="flex-1 h-6 rounded bg-accent-400/20 hover:bg-accent-400/30 flex items-center justify-center text-accent-400 transition-colors">
                    <Icon icon="solar:eye-bold" width={12} />
                  </button>
                  <button onClick={() => adjustSegmentByFrames("start", 1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <Icon icon="solar:alt-arrow-right-bold" width={12} />
                  </button>
                  <button onClick={() => adjustSegmentByFrames("start", 10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <span className="text-[9px] font-medium">+10</span>
                  </button>
                </div>
                <div
                  className="relative bg-black rounded overflow-hidden group cursor-pointer max-w-[140px]"
                  onClick={() => seekToSegmentBoundary("start")}
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wide">End (OUT)</div>
                  <div className="font-mono text-[10px] text-text-primary">
                    {formatTime(segments[activeSegmentIndex].end)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => adjustSegmentByFrames("end", -10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <span className="text-[9px] font-medium">-10</span>
                  </button>
                  <button onClick={() => adjustSegmentByFrames("end", -1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <Icon icon="solar:alt-arrow-left-bold" width={12} />
                  </button>
                  <button onClick={() => seekToSegmentBoundary("end")} className="flex-1 h-6 rounded bg-accent-400/20 hover:bg-accent-400/30 flex items-center justify-center text-accent-400 transition-colors">
                    <Icon icon="solar:eye-bold" width={12} />
                  </button>
                  <button onClick={() => adjustSegmentByFrames("end", 1)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <Icon icon="solar:alt-arrow-right-bold" width={12} />
                  </button>
                  <button onClick={() => adjustSegmentByFrames("end", 10)} className="flex-1 h-6 rounded bg-surface-base hover:bg-surface-dark flex items-center justify-center text-text-secondary transition-colors">
                    <span className="text-[9px] font-medium">+10</span>
                  </button>
                </div>
                <div
                  className="relative bg-black rounded overflow-hidden group cursor-pointer max-w-[140px]"
                  onClick={() => seekToSegmentBoundary("end")}
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
        )}

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

        <div className="flex items-start gap-2 text-xs text-text-tertiary bg-surface-elevated/50 p-2 rounded-lg">
          <Icon icon="solar:info-circle-bold" width={14} className="mt-0.5 shrink-0 text-accent-400" />
          <span><strong className="text-yellow-400">Important:</strong> The <strong className="text-text-secondary">first frame of each segment must show a face</strong> for the swap to work. Select clips with <strong className="text-text-secondary">clear talking faces</strong> and <strong className="text-text-secondary">no text overlays</strong>. Drag handles to preview frames.</span>
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
