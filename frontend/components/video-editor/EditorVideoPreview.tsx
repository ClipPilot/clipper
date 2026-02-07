"use client";

import React, { useRef, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { Icon } from "@iconify/react";
import {
  captionsEnabledAtom,
  captionsDataAtom,
  captionColorAtom,
  captionFontAtom,
  headingStateAtom,
  currentTimeAtom,
  cropStateAtom,
  speedStateAtom,
  audioStateAtom,
  trimStateAtom,
  videoDurationAtom,
  activeSegmentsAtom,
} from "@/store/videoEditor";
import { CAPTION_FONTS, HEADING_FONTS } from "@/constants/overlayStyles";
import { CaptionEntry } from "@/api/clips";

interface EditorVideoPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl?: string;
  onLoadedMetadata: () => void;
  onTimeUpdate: () => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  currentTime: number;
  isInGap?: boolean;
}

export function EditorVideoPreview({
  videoRef,
  videoUrl,
  onLoadedMetadata,
  onTimeUpdate,
  onPlayPause,
  isPlaying,
  currentTime,
  isInGap = false,
}: EditorVideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  // Atom values
  const captionsEnabled = useAtomValue(captionsEnabledAtom);
  const captionsData = useAtomValue(captionsDataAtom);
  const captionColor = useAtomValue(captionColorAtom);
  const captionFont = useAtomValue(captionFontAtom);
  const headingState = useAtomValue(headingStateAtom);
  const cropState = useAtomValue(cropStateAtom);
  const globalSpeed = useAtomValue(speedStateAtom);
  const audioState = useAtomValue(audioStateAtom);
  const trimState = useAtomValue(trimStateAtom);
  const videoDuration = useAtomValue(videoDurationAtom);
  const activeSegments = useAtomValue(activeSegmentsAtom);

  // Get current segment based on playhead position
  const currentSegment = React.useMemo(() => {
    return activeSegments.find(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    );
  }, [activeSegments, currentTime]);

  // Current speed: use segment speed if available, otherwise global speed
  const speed = currentSegment?.speed ?? globalSpeed;

  // Update container height
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Apply playback rate for speed preview (uses current segment's speed)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, videoRef, currentSegment?.id]);

  // Apply volume and mute state for audio preview
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = audioState.originalVolume;
      videoRef.current.muted = audioState.originalMuted;
    }
  }, [audioState.originalVolume, audioState.originalMuted, videoRef]);

  // Setup background music audio element
  useEffect(() => {
    const bgMusic = audioState.backgroundMusic;

    if (bgMusic?.url) {
      // Create audio element if it doesn't exist or URL changed
      if (!bgMusicRef.current || bgMusicRef.current.src !== bgMusic.url) {
        if (bgMusicRef.current) {
          bgMusicRef.current.pause();
        }
        bgMusicRef.current = new Audio(bgMusic.url);
        bgMusicRef.current.loop = true;
      }
      bgMusicRef.current.volume = bgMusic.volume;
    } else if (bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current = null;
    }

    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
      }
    };
  }, [audioState.backgroundMusic?.url, audioState.backgroundMusic?.volume]);

  // Sync background music with video playback
  useEffect(() => {
    const bgMusic = audioState.backgroundMusic;
    if (!bgMusicRef.current || !bgMusic) return;

    // Determine end time (use trim end if set, otherwise video duration)
    const endTime = trimState.endTime > 0 ? trimState.endTime : videoDuration;

    if (isPlaying) {
      // Check if we're within the valid playback range for music
      const isInMusicRange = currentTime >= bgMusic.startTime && currentTime < endTime;

      if (isInMusicRange) {
        // Calculate where in the music track we should be
        const musicTime = (currentTime - bgMusic.startTime) % bgMusic.duration;

        // Only seek if we're significantly out of sync (>0.3s)
        if (Math.abs(bgMusicRef.current.currentTime - musicTime) > 0.3) {
          bgMusicRef.current.currentTime = musicTime;
        }

        if (bgMusicRef.current.paused) {
          bgMusicRef.current.play().catch(() => {});
        }
      } else {
        bgMusicRef.current.pause();
      }
    } else {
      bgMusicRef.current.pause();
    }
  }, [isPlaying, currentTime, audioState.backgroundMusic, trimState.endTime, videoDuration]);

  // Apply playback rate to background music
  useEffect(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.playbackRate = speed;
    }
  }, [speed]);

  const scale = containerHeight / 1920;

  const getFontId = (fontName: string, fonts: typeof CAPTION_FONTS) =>
    fonts.find((f) => f.name === fontName)?.id || "montserrat";

  const isActiveCaption = (caption: CaptionEntry): boolean => {
    return currentTime >= caption.startTime && currentTime < caption.endTime;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate crop preview styles
  const getCropPreviewStyle = (): React.CSSProperties => {
    if (cropState.aspectRatio === "9:16") {
      return {}; // Default, no transform needed
    }

    // For preview purposes, we show a visual indicator but don't actually crop
    // The actual cropping happens on the backend
    return {};
  };

  return (
    <div className="bg-surface-base border border-border-base rounded-xl p-4">
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[65vh] mx-auto"
        style={getCropPreviewStyle()}
      >
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => {}}
              onPause={() => {}}
              playsInline
            />

            {/* Black overlay when in gap (cut region) */}
            {isInGap && (
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <div className="text-text-tertiary text-sm flex items-center gap-2">
                  <Icon icon="solar:scissors-bold" className="text-lg" />
                  Cut
                </div>
              </div>
            )}

            {/* Play/Pause Overlay */}
            <button
              onClick={onPlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
            >
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Icon
                  icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"}
                  className="text-white text-3xl"
                />
              </div>
            </button>

            {/* Captions Preview */}
            {captionsEnabled && captionsData.length > 0 && containerHeight > 0 && (() => {
              const activeCaption = captionsData.find((c) => isActiveCaption(c));
              if (!activeCaption) return null;

              return (
                <div
                  className="absolute left-0 right-0 pointer-events-none flex justify-center"
                  style={{
                    bottom: `${Math.round(280 * scale)}px`,
                    padding: `0 ${Math.round(80 * scale)}px`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: `var(--font-${getFontId(captionFont, CAPTION_FONTS)}), sans-serif`,
                      fontSize: `${Math.round(120 * scale)}px`,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      textAlign: "center",
                      lineHeight: 1.2,
                      letterSpacing: `${Math.round(2 * scale)}px`,
                      WebkitTextStroke: `${Math.max(1, Math.round(6 * scale))}px black`,
                      paintOrder: "stroke fill",
                      textShadow: `${Math.round(2 * scale)}px ${Math.round(2 * scale)}px ${Math.round(4 * scale)}px rgba(0,0,0,0.5)`,
                      maxWidth: "100%",
                      wordWrap: "break-word",
                    }}
                  >
                    {activeCaption.text.split(" ").map((word, idx) => (
                      <span
                        key={idx}
                        style={{
                          color:
                            idx ===
                            Math.floor(
                              ((currentTime - activeCaption.startTime) /
                                (activeCaption.endTime - activeCaption.startTime)) *
                                activeCaption.text.split(" ").length
                            )
                              ? captionColor
                              : "#FFFFFF",
                        }}
                      >
                        {word}{" "}
                      </span>
                    ))}
                  </p>
                </div>
              );
            })()}

            {/* Heading Preview */}
            {headingState && headingState.text && containerHeight > 0 && (
              <div
                className="absolute pointer-events-none px-3 py-1 rounded"
                style={{
                  left: `${headingState.x}%`,
                  top: `${headingState.y}%`,
                  transform: "translate(-50%, -50%)",
                  color: headingState.color,
                  fontSize: `${Math.round(headingState.fontSize * scale)}px`,
                  fontWeight: 900,
                  WebkitTextStroke: `${Math.max(1, Math.round(4 * scale))}px #000000`,
                  paintOrder: "stroke fill",
                  fontFamily: `var(--font-${getFontId(headingState.font, HEADING_FONTS)}), sans-serif`,
                  textAlign: "center",
                  lineHeight: 1.2,
                  maxWidth: "90%",
                }}
              >
                {headingState.text}
              </div>
            )}

            {/* Crop Overlay Preview */}
            {cropState.aspectRatio !== "9:16" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  Crop: {cropState.aspectRatio}
                </div>
              </div>
            )}

            {/* Speed Indicator - shows current segment speed */}
            {speed !== 1.0 && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Icon icon="solar:speedometer-bold" />
                {speed}x
                {activeSegments.length > 1 && currentSegment && (
                  <span className="text-text-tertiary ml-1">(segment)</span>
                )}
              </div>
            )}

            {/* Background Music Indicator */}
            {audioState.backgroundMusic && (
              <div
                className={`absolute ${speed !== 1.0 ? "top-10" : "top-2"} right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1`}
              >
                <Icon icon="solar:music-notes-bold" className={isPlaying && currentTime >= audioState.backgroundMusic.startTime ? "animate-pulse" : ""} />
                Music
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon icon="solar:video-frame-play-vertical-bold-duotone" className="text-6xl text-text-tertiary" />
          </div>
        )}
      </div>

      {/* Time Display */}
      <div className="flex items-center justify-center gap-4 mt-3">
        <button
          onClick={onPlayPause}
          className="p-2 rounded-full bg-surface-elevated hover:bg-surface-hover transition-colors"
        >
          <Icon
            icon={isPlaying ? "solar:pause-bold" : "solar:play-bold"}
            className="text-xl text-text-primary"
          />
        </button>
        <span className="text-sm text-text-secondary font-mono">
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}
