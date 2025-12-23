"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import {
  Button,
  Input,
  Spinner,
  Slider,
  Textarea,
  Switch,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { clipsAPI, Clip, CaptionEntry } from "@/api/clips";

const CAPTION_COLORS = [
  { color: "#FFFFFF", name: "White" },
  { color: "#000000", name: "Black" },
  { color: "#FF0000", name: "Red" },
  { color: "#FF6B00", name: "Orange" },
  { color: "#FFD600", name: "Yellow" },
  { color: "#00FF00", name: "Lime" },
  { color: "#00D4AA", name: "Teal" },
  { color: "#0084FF", name: "Blue" },
  { color: "#7B2CBF", name: "Purple" },
  { color: "#FF006E", name: "Pink" },
  { color: "#8B4513", name: "Brown" },
  { color: "#808080", name: "Gray" },
];

const CAPTION_FONTS = [
  { id: "luckiest-guy", name: "Luckiest Guy" },
  { id: "montserrat", name: "Montserrat" },
  { id: "everlasting", name: "Everlasting" },
  { id: "komika", name: "Komika" },
  { id: "burbank", name: "Burbank" },
  { id: "bebas-neue", name: "Bebas Neue" },
  { id: "anton", name: "Anton" },
];

// Heading fonts - only Google Fonts that work with Puppeteer rendering
const HEADING_FONTS = [
  { id: "luckiest-guy", name: "Luckiest Guy" },
  { id: "montserrat", name: "Montserrat" },
  { id: "bebas-neue", name: "Bebas Neue" },
  { id: "anton", name: "Anton" },
];

export default function EditClipPage() {
  const params = useParams();
  const router = useRouter();
  const clipId = parseInt(params.clipId as string);
  const [selectedTeam] = useAtom(selectedTeamAtom);

  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [captionColor, setCaptionColor] = useState("#FFD600");
  const [captionFont, setCaptionFont] = useState("Luckiest Guy");

  const [textOverlay, setTextOverlay] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState("Montserrat");
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(10);
  const [fontSize, setFontSize] = useState(48);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (selectedTeam?.id && clipId) {
      loadClip();
    }
  }, [selectedTeam?.id, clipId]);

  // Measure container for accurate caption preview sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [clip]);

  const loadClip = async () => {
    if (!selectedTeam?.id) return;
    setLoading(true);
    try {
      const data = await clipsAPI.getClip(selectedTeam.id, clipId);

      // Security check: Block access if clip is not saved or doesn't belong to user's team
      if (!data.saved || data.team_id !== selectedTeam.id) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setClip(data);
      if (data.captions_data) {
        setCaptions(JSON.parse(JSON.stringify(data.captions_data)));
      }
      // Load caption settings from metadata
      const metadata = data.clip_metadata as any;
      if (metadata?.parameters?.captionColor) {
        setCaptionColor(metadata.parameters.captionColor);
      }
      if (metadata?.parameters?.captionFont) {
        setCaptionFont(metadata.parameters.captionFont);
      }
      // Default to true if captions exist, can be overridden by saved setting
      if (metadata?.parameters?.captionsEnabled !== undefined) {
        setCaptionsEnabled(metadata.parameters.captionsEnabled);
      } else {
        setCaptionsEnabled(metadata?.parameters?.captions !== false);
      }
    } catch (error) {
      console.error("Failed to load clip:", error);
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleJumpToCaption = (startTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  };

  const handleCaptionTextChange = (index: number, text: string) => {
    setCaptions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, text } : c))
    );
  };

  const isActiveCaption = (caption: CaptionEntry): boolean => {
    return currentTime >= caption.startTime && currentTime < caption.endTime;
  };

  const handleApplyChanges = async () => {
    if (!selectedTeam?.id || !clip) return;
    setSaving(true);
    try {
      const result = await clipsAPI.updateClipOverlays(
        selectedTeam.id,
        clip.id,
        {
          captionsEnabled,
          captionsData: captions,
          captionColor,
          captionFont,
          heading: textOverlay.trim() ? {
            text: textOverlay,
            color: textColor,
            font: textFont,
            x: textX,
            y: textY,
            fontSize,
          } : undefined,
        }
      );
      setClip((prev) => (prev ? { ...prev, clipUrl: result.clipUrl } : null));
      addToast({
        title: "Processing",
        description: "Your changes are being applied. The updated video will be available shortly.",
        color: "success",
      });
    } catch (error) {
      console.error("Failed to apply changes:", error);
      addToast({
        title: "Failed to apply",
        description: "Something went wrong. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Icon
            icon="solar:lock-keyhole-bold-duotone"
            className="text-red-500"
            width={32}
          />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          Access Denied
        </h2>
        <p className="text-text-secondary mb-6">
          You don&apos;t have permission to edit this clip.
        </p>
        <Button
          color="primary"
          onPress={() => router.push("/dashboard/clips")}
          startContent={<Icon icon="solar:arrow-left-outline" />}
        >
          Back to Clips
        </Button>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <p className="text-text-secondary">Clip not found</p>
      </div>
    );
  }

  const videoUrl = clip.blankVideoUrl || clip.clipUrl;

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="light"
            startContent={<Icon icon="solar:arrow-left-outline" />}
            onPress={() => router.push("/dashboard/clips")}
          >
            Back
          </Button>
          <h1 className="text-2xl font-bold text-text-primary">
            Edit Clip: {clip.title || `#${clip.id}`}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-base border border-border-base rounded-xl p-4">
            <div
              ref={containerRef}
              className="relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[70vh] mx-auto"
            >
              {videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain"
                    onTimeUpdate={handleTimeUpdate}
                  />
                  {/* Caption Preview Overlay - matches backend ASS styling */}
                  {captionsEnabled && captions.length > 0 && containerHeight > 0 && (
                    (() => {
                      const activeCaption = captions.find(c => isActiveCaption(c));
                      if (!activeCaption) return null;

                      // Backend: 1080x1920, FontSize=120, MarginV=280, Outline=6
                      // Scale factor: containerHeight / 1920
                      const scale = containerHeight / 1920;
                      const scaledFontSize = Math.round(120 * scale);
                      const scaledMarginBottom = Math.round(280 * scale);
                      const scaledOutline = Math.max(1, Math.round(6 * scale));
                      const fontId = CAPTION_FONTS.find(f => f.name === captionFont)?.id || "montserrat";

                      return (
                        <div
                          className="absolute left-0 right-0 pointer-events-none flex justify-center"
                          style={{
                            bottom: `${scaledMarginBottom}px`,
                            padding: `0 ${Math.round(80 * scale)}px`,
                          }}
                        >
                          <p
                            style={{
                              fontFamily: `var(--font-${fontId}), sans-serif`,
                              fontSize: `${scaledFontSize}px`,
                              fontWeight: 700,
                              color: "#FFFFFF",
                              textAlign: "center",
                              lineHeight: 1.2,
                              letterSpacing: `${Math.round(2 * scale)}px`,
                              WebkitTextStroke: `${scaledOutline}px black`,
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
                                  color: idx === Math.floor(
                                    ((currentTime - activeCaption.startTime) /
                                    (activeCaption.endTime - activeCaption.startTime)) *
                                    activeCaption.text.split(" ").length
                                  ) ? captionColor : "#FFFFFF",
                                }}
                              >
                                {word}{" "}
                              </span>
                            ))}
                          </p>
                        </div>
                      );
                    })()
                  )}
                  {textOverlay && (
                    (() => {
                      const fontId = HEADING_FONTS.find(f => f.name === textFont)?.id || "montserrat";
                      return (
                        <div
                          className="absolute pointer-events-none px-3 py-1 rounded whitespace-nowrap"
                          style={{
                            left: `${textX}%`,
                            top: `${textY}%`,
                            transform: "translate(-50%, -50%)",
                            color: textColor,
                            fontSize: `${fontSize * 0.4}px`,
                            fontWeight: 900,
                            WebkitTextStroke: `${Math.max(1, fontSize * 0.03)}px #000000`,
                            paintOrder: "stroke fill",
                            fontFamily: `var(--font-${fontId}), sans-serif`,
                            textAlign: "center",
                            lineHeight: 1.2,
                          }}
                        >
                          {textOverlay}
                        </div>
                      );
                    })()
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon
                    icon="solar:video-frame-play-vertical-bold-duotone"
                    className="text-6xl text-text-tertiary"
                  />
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-text-tertiary text-center">
              Current: {formatTime(currentTime)}
            </p>
          </div>

          <div className="bg-surface-base border border-border-base rounded-xl p-4 overflow-y-auto max-h-[85vh]">
            <div className="space-y-6">
              {/* Captions Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Icon icon="solar:subtitles-outline" className="text-accent-400" />
                  <h3 className="text-lg font-semibold text-text-primary">Captions</h3>
                </div>

                {captions.length > 0 && (
                  <div className="mb-4 p-4 rounded-lg bg-surface-elevated border border-border-base">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon
                          icon={captionsEnabled ? "solar:subtitles-bold" : "solar:subtitles-outline"}
                          className={captionsEnabled ? "text-accent-400" : "text-text-tertiary"}
                          width={24}
                        />
                        <div>
                          <p className="text-sm font-medium text-text-primary">Show Captions</p>
                          <p className="text-xs text-text-tertiary">
                            {captionsEnabled ? "Captions will appear on the video" : "Video will have no captions"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        isSelected={captionsEnabled}
                        onValueChange={setCaptionsEnabled}
                        color="success"
                        size="lg"
                      />
                    </div>
                  </div>
                )}

                {captions.length > 0 && captionsEnabled && (
                  <div className="mb-4 p-4 rounded-lg bg-surface-elevated border border-border-base">
                    <p className="text-sm font-medium text-text-primary mb-3">Caption Style</p>
                    <div className="mb-4">
                      <label className="text-xs text-text-secondary mb-2 block">Highlight Color</label>
                      <div className="flex flex-wrap gap-2">
                        {CAPTION_COLORS.map((c) => (
                          <button
                            key={c.color}
                            onClick={() => setCaptionColor(c.color)}
                            className={`h-8 w-8 rounded border-2 transition-all ${
                              captionColor === c.color
                                ? "border-accent-400 ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-elevated scale-110"
                                : "border-border-base hover:scale-105"
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-text-secondary mb-2 block">Caption Font</label>
                      <div className="flex gap-2 overflow-x-auto py-1">
                        {CAPTION_FONTS.map((font) => (
                          <button
                            key={font.id}
                            onClick={() => setCaptionFont(font.name)}
                            className={`h-12 w-12 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 ${
                              captionFont === font.name
                                ? "bg-white text-black border-white scale-105"
                                : "bg-surface-base text-white border-border-base hover:scale-105"
                            }`}
                            title={font.name}
                          >
                            <span className="text-base font-bold" style={{ fontFamily: `var(--font-${font.id})` }}>Ag</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-sm text-text-secondary mb-2">{captions.length} caption segments</p>
                <div className="h-[25vh] overflow-y-auto space-y-2 pr-2">
                  {captions.map((caption, index) => (
                    <div
                      key={caption.index}
                      className={`p-3 rounded-lg border transition-all ${
                        isActiveCaption(caption) ? "bg-accent-400/10 border-accent-400" : "bg-surface-elevated border-border-base"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => handleJumpToCaption(caption.startTime)}
                          className="flex items-center gap-2 text-xs text-text-tertiary hover:text-accent-400"
                        >
                          <Icon icon="solar:play-circle-outline" />
                          {formatTime(caption.startTime)} - {formatTime(caption.endTime)}
                        </button>
                        <span className="text-xs text-text-tertiary">#{caption.index}</span>
                      </div>
                      <Input
                        value={caption.text}
                        onChange={(e) => handleCaptionTextChange(index, e.target.value)}
                        variant="bordered"
                        size="sm"
                        classNames={{ inputWrapper: "bg-surface-base border-border-base" }}
                      />
                    </div>
                  ))}
                  {captions.length === 0 && (
                    <div className="text-center py-8">
                      <Icon icon="solar:subtitles-outline" className="text-4xl text-text-tertiary mb-2 mx-auto" />
                      <p className="text-text-secondary">No captions available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border-base" />

              {/* Heading Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Icon icon="solar:text-bold" className="text-accent-400" />
                  <h3 className="text-lg font-semibold text-text-primary">Heading</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">Text</label>
                    <Textarea
                      value={textOverlay}
                      onChange={(e) => setTextOverlay(e.target.value)}
                      placeholder="Enter Heading (optional)..."
                      variant="bordered"
                      minRows={2}
                      maxRows={3}
                      classNames={{ inputWrapper: "bg-surface-base border-border-base", input: "text-base" }}
                    />
                  </div>

                  {textOverlay.trim() && (
                    <>
                      <div>
                        <label className="text-sm text-text-secondary mb-2 block">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { color: "#FFFFFF", name: "White" },
                            { color: "#FFD600", name: "Yellow" },
                            { color: "#FF0000", name: "Red" },
                            { color: "#00FF00", name: "Green" },
                            { color: "#00BFFF", name: "Blue" },
                            { color: "#FF69B4", name: "Pink" },
                            { color: "#FFA500", name: "Orange" },
                            { color: "#9B59B6", name: "Purple" },
                          ].map((preset) => (
                            <button
                              key={preset.color}
                              onClick={() => setTextColor(preset.color)}
                              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                textColor === preset.color ? "border-accent-400 scale-110" : "border-border-base hover:border-accent-400/50"
                              }`}
                              style={{ backgroundColor: preset.color }}
                              title={preset.name}
                            />
                          ))}
                          <div className="relative">
                            <input
                              type="color"
                              value={textColor}
                              onChange={(e) => setTextColor(e.target.value)}
                              className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                            />
                            <div className="w-8 h-8 rounded-lg border-2 border-border-base flex items-center justify-center bg-surface-elevated" title="Custom color">
                              <Icon icon="solar:palette-bold" className="text-text-secondary text-sm" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-text-secondary mb-2 block">Font</label>
                        <div className="flex gap-2 overflow-x-auto py-1">
                          {HEADING_FONTS.map((font) => (
                            <button
                              key={font.id}
                              onClick={() => setTextFont(font.name)}
                              className={`h-10 w-10 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 ${
                                textFont === font.name ? "bg-white text-black border-white scale-105" : "bg-surface-base text-white border-border-base hover:scale-105"
                              }`}
                              title={font.name}
                            >
                              <span className="text-sm font-bold" style={{ fontFamily: `var(--font-${font.id})` }}>Ag</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-text-secondary mb-1 block">X Position: {textX}%</label>
                          <Slider value={textX} onChange={(val) => setTextX(val as number)} minValue={0} maxValue={100} step={1} color="secondary" size="sm" />
                        </div>
                        <div>
                          <label className="text-xs text-text-secondary mb-1 block">Y Position: {textY}%</label>
                          <Slider value={textY} onChange={(val) => setTextY(val as number)} minValue={0} maxValue={100} step={1} color="secondary" size="sm" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-text-secondary mb-1 block">Font Size: {fontSize}px</label>
                        <Slider value={fontSize} onChange={(val) => setFontSize(val as number)} minValue={16} maxValue={120} step={2} color="secondary" size="sm" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Apply All Changes Button */}
              <div className="pt-4 border-t border-border-base">
                <Button
                  color="primary"
                  className="w-full"
                  size="lg"
                  onPress={handleApplyChanges}
                  isDisabled={saving}
                  startContent={saving ? <Spinner size="sm" /> : <Icon icon="solar:diskette-bold" />}
                >
                  {saving ? "Applying..." : "Apply All Changes"}
                </Button>
                <p className="text-xs text-text-tertiary text-center mt-2">
                  This will apply both captions and heading settings
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
