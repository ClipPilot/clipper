"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { faceSwapAPI } from "@/api/ugc/faceSwap";
import { VideoSegment, FRAME_DURATION, formatTime } from "./types";
import { VideoPlayerSection } from "./VideoPlayerSection";
import { Timeline } from "./Timeline";
import { SegmentPills } from "./SegmentPills";
import { FineTunePanel } from "./FineTunePanel";

interface MultiSegmentTrimmerProps {
  videoSrc: string;
  videoFile?: File;
  duration: number;
  segments: VideoSegment[];
  onSegmentsChange: (segments: VideoSegment[]) => void;
  maxTotalDuration?: number;
  maxSegments?: number;
}

export function MultiSegmentTrimmer({
  videoSrc,
  videoFile,
  duration,
  segments,
  onSegmentsChange,
  maxTotalDuration = 60,
  maxSegments = 5,
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

  const totalDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const exceedsMax = totalDuration > maxTotalDuration + 0.01;

  // Get current segment index based on playhead position
  const getCurrentSegmentIndex = useCallback((): number => {
    for (let i = 0; i < segments.length; i++) {
      if (currentTime >= segments[i].start && currentTime < segments[i].end) {
        return i;
      }
    }
    return -1;
  }, [segments, currentTime]);

  const currentSegmentIndex = getCurrentSegmentIndex();

  // Frame capture utility
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

  // Update frame previews for fine-tune panel
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

  // Seek to position on timeline
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

  // Video playback controls
  const togglePlayPause = useCallback(() => {
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
  }, [isPlaying, segments, activeSegmentIndex]);

  const stepFrame = useCallback((direction: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + direction * FRAME_DURATION, duration));
  }, [duration]);

  const playSegment = useCallback((index: number) => {
    const video = videoRef.current;
    const segment = segments[index];
    if (!video || !segment) return;

    setActiveSegmentIndex(index);
    video.currentTime = segment.start;
    video.play();
    setIsPlaying(true);
  }, [segments]);

  // Segment manipulation
  const adjustSegmentByFrames = useCallback((edge: "start" | "end", frames: number) => {
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
      if (videoRef.current) {
        videoRef.current.currentTime = newEnd - 0.001;
        setCurrentTime(newEnd - 0.001);
      }
    }

    onSegmentsChange(updated);
  }, [segments, activeSegmentIndex, duration, onSegmentsChange]);

  const seekToSegmentBoundary = useCallback((edge: "start" | "end") => {
    const segment = segments[activeSegmentIndex];
    if (!segment || !videoRef.current) return;

    const time = edge === "start" ? segment.start : segment.end - 0.001;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  }, [segments, activeSegmentIndex]);

  const addSegment = useCallback(() => {
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
  }, [segments, maxSegments, maxTotalDuration, totalDuration, duration, currentTime, onSegmentsChange]);

  const removeSegment = useCallback((index: number) => {
    if (segments.length <= 1) return;
    const updated = segments.filter((_, i) => i !== index);
    onSegmentsChange(updated);
    setActiveSegmentIndex(Math.min(activeSegmentIndex, updated.length - 1));
  }, [segments, activeSegmentIndex, onSegmentsChange]);

  // Face detection
  const handleAutoDetectFaces = useCallback(async () => {
    if (!videoFile || isDetectingFaces) return;

    setIsDetectingFaces(true);
    addToast({
      title: "Detecting faces...",
      description: "This may take 1-3 minutes. Please wait.",
      color: "primary",
    });

    try {
      const data = await faceSwapAPI.detectFaces(videoFile);

      if (data.segments && data.segments.length > 0) {
        let selectedSegments: VideoSegment[] = [];
        let detectedTotalDuration = 0;

        for (const seg of data.segments) {
          if (selectedSegments.length >= maxSegments) break;

          const segDuration = seg.end - seg.start;
          if (detectedTotalDuration + segDuration <= maxTotalDuration) {
            selectedSegments.push({
              id: crypto.randomUUID(),
              start: seg.start,
              end: seg.end,
            });
            detectedTotalDuration += segDuration;
          } else if (detectedTotalDuration < maxTotalDuration) {
            const availableDuration = maxTotalDuration - detectedTotalDuration;
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
  }, [videoFile, isDetectingFaces, maxSegments, maxTotalDuration, onSegmentsChange]);

  // Timeline drag handlers
  const handleSegmentMouseDown = useCallback((
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
  }, [segments]);

  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
    }
  }, [isPlaying]);

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

          if (videoRef.current) {
            videoRef.current.currentTime = adjustedEnd;
            setCurrentTime(adjustedEnd);
          }
        }
      }
    },
    [isDragging, isDraggingPlayhead, seekToPosition, duration, segments, maxTotalDuration, onSegmentsChange, dragStartX, dragStartSegment]
  );

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
    setDragStartSegment(null);
    setIsDraggingPlayhead(false);
  }, []);

  // Effects
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

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [segments, activeSegmentIndex, isPlaying, isDraggingPlayhead]);

  useEffect(() => {
    if (!videoRef.current || segments.length === 0) return;

    const segment = segments[activeSegmentIndex];
    if (!segment) return;

    const timer = setTimeout(() => {
      updateFramePreviews();
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSegmentIndex, segments, updateFramePreviews]);

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

  // Segment click handler
  const handleSegmentClick = useCallback((index: number) => {
    setActiveSegmentIndex(index);
    if (videoRef.current) {
      videoRef.current.currentTime = segments[index].start;
      setCurrentTime(segments[index].start);
    }
  }, [segments]);

  return (
    <div className="space-y-4">
      <VideoPlayerSection
        ref={videoRef}
        videoSrc={videoSrc}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        currentSegmentIndex={currentSegmentIndex}
        onTogglePlayPause={togglePlayPause}
        onStepFrame={stepFrame}
      />

      <div className="space-y-3">
        <Timeline
          ref={timelineRef}
          duration={duration}
          segments={segments}
          activeSegmentIndex={activeSegmentIndex}
          currentTime={currentTime}
          thumbnails={thumbnails}
          isGeneratingThumbnails={isGeneratingThumbnails}
          isDraggingPlayhead={isDraggingPlayhead}
          onSeekToPosition={seekToPosition}
          onSegmentMouseDown={handleSegmentMouseDown}
          onPlayheadMouseDown={handlePlayheadMouseDown}
        />

        <SegmentPills
          segments={segments}
          activeSegmentIndex={activeSegmentIndex}
          maxSegments={maxSegments}
          maxTotalDuration={maxTotalDuration}
          totalDuration={totalDuration}
          videoFile={videoFile}
          isDetectingFaces={isDetectingFaces}
          onSegmentClick={handleSegmentClick}
          onPlaySegment={playSegment}
          onRemoveSegment={removeSegment}
          onAddSegment={addSegment}
          onAutoDetectFaces={handleAutoDetectFaces}
        />

        {segments[activeSegmentIndex] && (
          <FineTunePanel
            segment={segments[activeSegmentIndex]}
            segmentIndex={activeSegmentIndex}
            startFramePreview={startFramePreview}
            endFramePreview={endFramePreview}
            onAdjustFrames={adjustSegmentByFrames}
            onSeekToBoundary={seekToSegmentBoundary}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
          <div className="text-xs sm:text-sm text-text-tertiary">
            {segments.length} segment{segments.length !== 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary text-xs sm:text-sm">Total:</span>
            <span
              className={`font-mono text-xs sm:text-sm font-medium ${
                exceedsMax ? "text-red-500" : "text-accent-400"
              }`}
            >
              {formatTime(totalDuration)}
            </span>
            <span className="text-text-muted text-[10px] sm:text-xs">/ {maxTotalDuration}s max</span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[10px] sm:text-xs text-text-tertiary bg-surface-elevated/50 p-2 rounded-lg">
          <Icon icon="solar:info-circle-bold" width={14} className="mt-0.5 shrink-0 text-accent-400" />
          <span><strong className="text-yellow-400">Important:</strong> The <strong className="text-text-secondary">first frame must show a face</strong> for the swap to work. Select clips with <strong className="text-text-secondary">clear talking faces</strong> and <strong className="text-text-secondary">no text overlays</strong>.</span>
        </div>

        {exceedsMax && (
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
            <Icon icon="solar:danger-circle-bold" width={16} className="shrink-0" />
            <span>Combined segment duration must be {maxTotalDuration}s or less</span>
          </div>
        )}
      </div>
    </div>
  );
}
