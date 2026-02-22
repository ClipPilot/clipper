"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
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
  mediaOverlaysAtom,
  selectedOverlayIdAtom,
} from "@/store/videoEditor";
import { CAPTION_FONTS, HEADING_FONTS } from "@/constants/overlayStyles";
import { CaptionEntry } from "@/api/clips";
import { CommentPreview } from "./CommentPreview";

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

  // Overlay drag state
  const setOverlays = useSetAtom(mediaOverlaysAtom);
  const setSelectedOverlayId = useSetAtom(selectedOverlayIdAtom);
  const selectedOverlayId = useAtomValue(selectedOverlayIdAtom);
  const dragRef = useRef<{
    overlayId: string;
    mode: "move" | "resize";
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    startScale: number;
  } | null>(null);

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
  const mediaOverlays = useAtomValue(mediaOverlaysAtom);

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

  // Overlay drag handlers
  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent, overlayId: string, currentX: number, currentY: number, currentScale: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (selectedOverlayId !== overlayId) {
        // First click selects, doesn't start drag
        setSelectedOverlayId(overlayId);
        return;
      }
      // Already selected — start move drag
      dragRef.current = {
        overlayId,
        mode: "move",
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: currentX,
        startY: currentY,
        startScale: currentScale,
      };
    },
    [selectedOverlayId, setSelectedOverlayId]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, overlayId: string, currentScale: number) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        overlayId,
        mode: "resize",
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startX: 0,
        startY: 0,
        startScale: currentScale,
      };
    },
    []
  );

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const id = dragRef.current.overlayId;

      if (dragRef.current.mode === "resize") {
        // Resize: use horizontal + vertical delta to adjust scale
        const deltaX = e.clientX - dragRef.current.startMouseX;
        const deltaY = e.clientY - dragRef.current.startMouseY;
        const delta = (deltaX + deltaY) / 2;
        const rect = containerRef.current.getBoundingClientRect();
        const scaleFactor = delta / (rect.width * 0.3);
        const newScale = Math.max(0.1, Math.min(5, dragRef.current.startScale + scaleFactor));
        setOverlays((prev) =>
          prev.map((o) => (o.id === id ? { ...o, scale: newScale } : o))
        );
      } else {
        // Move
        const rect = containerRef.current.getBoundingClientRect();
        const deltaXPercent = ((e.clientX - dragRef.current.startMouseX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - dragRef.current.startMouseY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, dragRef.current.startX + deltaXPercent));
        const newY = Math.max(0, Math.min(100, dragRef.current.startY + deltaYPercent));
        setOverlays((prev) =>
          prev.map((o) => (o.id === id ? { ...o, x: newX, y: newY } : o))
        );
      }
    },
    [setOverlays]
  );

  const handleContainerMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className="bg-surface-base border border-border-base rounded-xl p-4">
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[65vh] mx-auto"
        style={getCropPreviewStyle()}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
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

            {/* Media Overlays Preview */}
            {containerHeight > 0 && mediaOverlays.map((overlay) => {
              // Time-gate: only show if current time is within overlay range
              if (currentTime < overlay.startTime || currentTime > overlay.endTime) return null;

              const isSelected = selectedOverlayId === overlay.id;

              // Resize handle (shown on all selected overlays)
              const resizeHandle = isSelected ? (
                <div
                  className="absolute -bottom-2 -right-2 w-5 h-5 bg-purple-500 rounded-full cursor-se-resize flex items-center justify-center shadow-lg border-2 border-white z-20"
                  onMouseDown={(e) => handleResizeMouseDown(e, overlay.id, overlay.scale)}
                >
                  <Icon icon="solar:maximize-bold" className="text-white text-[8px]" />
                </div>
              ) : null;

              // Comment overlays render as React components
              if (overlay.type === "comment" && overlay.commentData) {
                return (
                  <div
                    key={overlay.id}
                    className={`absolute pointer-events-auto ${isSelected ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={{
                      left: `${overlay.x}%`,
                      top: `${overlay.y}%`,
                      transform: `translate(-50%, -50%) scale(${overlay.scale})`,
                      transformOrigin: "center center",
                      opacity: overlay.opacity,
                      outline: isSelected ? "2px solid rgba(139, 92, 246, 0.8)" : "none",
                      outlineOffset: "2px",
                      zIndex: isSelected ? 10 : 1,
                    }}
                    onMouseDown={(e) => handleOverlayMouseDown(e, overlay.id, overlay.x, overlay.y, overlay.scale)}
                  >
                    <CommentPreview commentData={overlay.commentData} scale={scale} />
                    {resizeHandle}
                  </div>
                );
              }

              // Image/video overlays render as media elements
              const scaledWidth = overlay.naturalWidth * overlay.scale * scale;
              const scaledHeight = overlay.naturalHeight * overlay.scale * scale;

              return (
                <div
                  key={overlay.id}
                  className={`absolute pointer-events-auto ${isSelected ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                  style={{
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: scaledWidth,
                    height: scaledHeight,
                    opacity: overlay.opacity,
                    outline: isSelected ? "2px solid rgba(139, 92, 246, 0.8)" : "none",
                    outlineOffset: "2px",
                    zIndex: isSelected ? 10 : 1,
                  }}
                  onMouseDown={(e) => handleOverlayMouseDown(e, overlay.id, overlay.x, overlay.y, overlay.scale)}
                >
                  {overlay.type === "image" ? (
                    <img
                      src={overlay.url}
                      alt={overlay.fileName}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  ) : (
                    <video
                      src={overlay.url}
                      className="w-full h-full object-contain"
                      muted
                      playsInline
                      autoPlay={isPlaying}
                    />
                  )}
                  {resizeHandle}
                </div>
              );
            })}

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
                      fontSize: `${Math.round(90 * scale)}px`,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      textAlign: "center",
                      lineHeight: 1.2,
                      letterSpacing: /[\u0900-\u097F]/.test(activeCaption.text) ? "0px" : `${Math.round(2 * scale)}px`,
                      WebkitTextStroke: `${Math.max(1, Math.round(4 * scale))}px black`,
                      paintOrder: "stroke fill",
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
