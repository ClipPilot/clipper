"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
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
  HeadingState,
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

  // Heading drag state
  const [headingDrag, setHeadingDrag] = useState<{
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [headingResizing, setHeadingResizing] = useState<{
    startMouseX: number;
    startMouseY: number;
    startFontSize: number;
  } | null>(null);

  // Atom values
  const captionsEnabled = useAtomValue(captionsEnabledAtom);
  const captionsData = useAtomValue(captionsDataAtom);
  const captionColor = useAtomValue(captionColorAtom);
  const captionFont = useAtomValue(captionFontAtom);
  const [headingState, setHeadingState] = useAtom(headingStateAtom);
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
      if (!bgMusicRef.current || bgMusicRef.current.src !== bgMusic.url) {
        if (bgMusicRef.current) {
          bgMusicRef.current.pause();
        }
        bgMusicRef.current = new Audio(bgMusic.url);
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

    const musicStart = bgMusic.startTime || 0;
    const trimStart = bgMusic.trimStart || 0;
    const trimEnd = bgMusic.trimEnd || bgMusic.duration;
    const trimmedDuration = trimEnd - trimStart;
    const musicEnd = musicStart + trimmedDuration;

    if (isPlaying) {
      const isInMusicRange = currentTime >= musicStart && currentTime < musicEnd;

      if (isInMusicRange) {
        const offset = currentTime - musicStart;
        const musicTime = trimStart + offset;

        if (Math.abs(bgMusicRef.current.currentTime - musicTime) > 0.3) {
          bgMusicRef.current.currentTime = musicTime;
        }

        if (bgMusicRef.current.currentTime >= trimEnd) {
          bgMusicRef.current.pause();
        } else if (bgMusicRef.current.paused) {
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
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Heading drag
      if (headingDrag) {
        const deltaXPercent = ((e.clientX - headingDrag.startMouseX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - headingDrag.startMouseY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, headingDrag.startX + deltaXPercent));
        const newY = Math.max(0, Math.min(100, headingDrag.startY + deltaYPercent));
        setHeadingState((prev) => prev ? { ...prev, x: newX, y: newY } : prev);
        return;
      }

      // Heading resize
      if (headingResizing) {
        const delta = (e.clientX - headingResizing.startMouseX + e.clientY - headingResizing.startMouseY) / 2;
        const sizeDelta = (delta / rect.height) * 120;
        const newSize = Math.max(16, Math.min(120, Math.round(headingResizing.startFontSize + sizeDelta)));
        setHeadingState((prev) => prev ? { ...prev, fontSize: newSize } : prev);
        return;
      }

      // Overlay drag
      if (!dragRef.current) return;
      const id = dragRef.current.overlayId;

      if (dragRef.current.mode === "resize") {
        const deltaX = e.clientX - dragRef.current.startMouseX;
        const deltaY = e.clientY - dragRef.current.startMouseY;
        const delta = (deltaX + deltaY) / 2;
        const scaleFactor = delta / (rect.width * 0.3);
        const newScale = Math.max(0.1, Math.min(5, dragRef.current.startScale + scaleFactor));
        setOverlays((prev) =>
          prev.map((o) => (o.id === id ? { ...o, scale: newScale } : o))
        );
      } else {
        const deltaXPercent = ((e.clientX - dragRef.current.startMouseX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - dragRef.current.startMouseY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, dragRef.current.startX + deltaXPercent));
        const newY = Math.max(0, Math.min(100, dragRef.current.startY + deltaYPercent));
        setOverlays((prev) =>
          prev.map((o) => (o.id === id ? { ...o, x: newX, y: newY } : o))
        );
      }
    },
    [setOverlays, headingDrag, headingResizing, setHeadingState]
  );

  const handleContainerMouseUp = useCallback(() => {
    dragRef.current = null;
    setHeadingDrag(null);
    setHeadingResizing(null);
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

            {/* Heading Preview — draggable + resizable.
                 Backend renders text in a 1080px-wide container (padding: 20px),
                 screenshots it, then overlays the full-width PNG centered at (x%, y%). */}
            {headingState && headingState.text && containerHeight > 0 && (() => {
              const isInstagram = headingState.style === "instagram";
              const isDragging = !!headingDrag || !!headingResizing;
              return (
                <div
                  className={`absolute ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                  style={{
                    width: "100%",
                    left: `${headingState.x - 50}%`,
                    top: `${headingState.y}%`,
                    transform: "translateY(-50%)",
                    textAlign: "center",
                    padding: `0 ${Math.round(20 * scale)}px`,
                    zIndex: 5,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setHeadingDrag({
                      startMouseX: e.clientX,
                      startMouseY: e.clientY,
                      startX: headingState.x,
                      startY: headingState.y,
                    });
                  }}
                >
                  <span
                    style={{
                      fontFamily: `var(--font-${getFontId(headingState.font, HEADING_FONTS)}), sans-serif`,
                      fontSize: `${Math.round(headingState.fontSize * scale)}px`,
                      fontWeight: isInstagram ? 600 : 900,
                      lineHeight: 1.2,
                      position: "relative",
                      ...(isInstagram
                        ? {
                            color: headingState.headingBgColor === "#FFFFFF" ? "#000000" : "#FFFFFF",
                            background: `${headingState.headingBgColor || "#000000"}d9`,
                            padding: `${Math.round(10 * scale)}px ${Math.round(24 * scale)}px`,
                            borderRadius: `${Math.round(20 * scale)}px`,
                          }
                        : {
                            color: headingState.color,
                            WebkitTextStroke: `${Math.max(1, Math.round(4 * scale))}px #000000`,
                            paintOrder: "stroke fill" as const,
                          }),
                    }}
                  >
                    {headingState.text}
                    {/* Resize handle */}
                    <span
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-accent-400 rounded-full cursor-se-resize flex items-center justify-center shadow-lg border border-white"
                      style={{ display: "inline-flex" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setHeadingResizing({
                          startMouseX: e.clientX,
                          startMouseY: e.clientY,
                          startFontSize: headingState.fontSize,
                        });
                      }}
                    >
                      <Icon icon="solar:maximize-bold" className="text-white text-[7px]" />
                    </span>
                  </span>
                </div>
              );
            })()}

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
