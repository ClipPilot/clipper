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
}

export function EditorVideoPreview({
  videoRef,
  videoUrl,
  onLoadedMetadata,
  onTimeUpdate,
  onPlayPause,
  isPlaying,
  currentTime,
}: EditorVideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  // Atom values
  const captionsEnabled = useAtomValue(captionsEnabledAtom);
  const captionsData = useAtomValue(captionsDataAtom);
  const captionColor = useAtomValue(captionColorAtom);
  const captionFont = useAtomValue(captionFontAtom);
  const headingState = useAtomValue(headingStateAtom);
  const cropState = useAtomValue(cropStateAtom);
  const speed = useAtomValue(speedStateAtom);

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

  // Apply playback rate for speed preview
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, videoRef]);

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

            {/* Speed Indicator */}
            {speed !== 1.0 && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Icon icon="solar:speedometer-bold" />
                {speed}x
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
