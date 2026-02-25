"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  currentTimeAtom,
  isPlayingAtom,
  activeSegmentsAtom,
} from "@/store/videoEditor";

/**
 * useGapAwarePlayback
 *
 * Manages playback that skips deleted gaps between segments.
 * When the video playhead enters a gap (a region not covered by any active
 * segment), this hook pauses the underlying video element and advances the
 * displayed currentTime via a JS interval until the next segment is reached,
 * then resumes video playback.
 *
 * Returns:
 *   - isInGap       — whether the playhead is currently traversing a gap
 *   - handleTimeUpdate — onTimeUpdate handler for the <video> element
 *   - seekToTime    — seek the playhead to an arbitrary time
 *   - togglePlayPause — toggle play/pause with gap-aware logic
 *
 * Usage:
 *   const { isInGap, handleTimeUpdate, seekToTime, togglePlayPause } =
 *     useGapAwarePlayback(videoRef);
 *   <video onTimeUpdate={handleTimeUpdate} ... />
 */
export function useGapAwarePlayback(videoRef: React.RefObject<HTMLVideoElement>) {
  const [currentTime, setCurrentTime] = useAtom(currentTimeAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const activeSegments = useAtomValue(activeSegmentsAtom);

  const [isInGap, setIsInGap] = useState(false);
  const gapIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: check if a time falls inside any active segment
  const isTimeInSegment = useCallback(
    (time: number) => {
      return activeSegments.some((s) => time >= s.startTime && time < s.endTime);
    },
    [activeSegments]
  );

  // Helper: find the next segment that starts after the given time
  const findNextSegment = useCallback(
    (time: number) => {
      const sorted = [...activeSegments].sort((a, b) => a.startTime - b.startTime);
      return sorted.find((s) => s.startTime > time);
    },
    [activeSegments]
  );

  const clearGapInterval = useCallback(() => {
    if (gapIntervalRef.current) {
      clearInterval(gapIntervalRef.current);
      gapIntervalRef.current = null;
    }
  }, []);

  // onTimeUpdate handler — pause in gaps, advance playhead via interval
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    const inSegment = isTimeInSegment(time);

    if (inSegment) {
      if (isInGap) {
        setIsInGap(false);
        clearGapInterval();
      }
    } else if (!videoRef.current.paused) {
      // Entering a gap — pause video and advance playhead via interval
      const nextSegment = findNextSegment(time);
      if (nextSegment) {
        videoRef.current.pause();
        setIsInGap(true);
        clearGapInterval();

        const gapStart = time;
        const gapEnd = nextSegment.startTime;
        const startRealTime = Date.now();

        gapIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startRealTime) / 1000;
          const newTime = gapStart + elapsed;

          if (newTime >= gapEnd) {
            clearGapInterval();
            setIsInGap(false);
            if (videoRef.current) {
              videoRef.current.currentTime = gapEnd;
              setCurrentTime(gapEnd);
              videoRef.current.play();
            }
          } else {
            setCurrentTime(newTime);
          }
        }, 33); // ~30 fps
      } else {
        // Past all segments — stop playback
        videoRef.current.pause();
        setIsPlaying(false);
        setIsInGap(false);
        clearGapInterval();
      }
    }
  }, [
    videoRef,
    setCurrentTime,
    isTimeInSegment,
    findNextSegment,
    isInGap,
    setIsPlaying,
    clearGapInterval,
  ]);

  const seekToTime = useCallback(
    (time: number) => {
      clearGapInterval();
      setIsInGap(false);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [videoRef, setCurrentTime, clearGapInterval]
  );

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      clearGapInterval();
      setIsInGap(false);
      setIsPlaying(false);
    } else {
      const time = videoRef.current.currentTime;
      const sorted = [...activeSegments].sort((a, b) => a.startTime - b.startTime);
      const lastSegment = sorted[sorted.length - 1];

      // If past all segments, loop back to the first segment's start
      if (lastSegment && time >= lastSegment.endTime) {
        videoRef.current.currentTime = sorted[0].startTime;
        setCurrentTime(sorted[0].startTime);
      }

      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [
    videoRef,
    isPlaying,
    setIsPlaying,
    activeSegments,
    setCurrentTime,
    clearGapInterval,
  ]);

  // Clean up gap interval on unmount
  useEffect(() => {
    return () => clearGapInterval();
  }, [clearGapInterval]);

  return { isInGap, handleTimeUpdate, seekToTime, togglePlayPause };
}
