"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { Button, Input, Tabs, Tab, Spinner, Slider, Textarea, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { clipsAPI, Clip, CaptionEntry } from "@/api/clips";

export default function EditClipPage() {
  const params = useParams();
  const router = useRouter();
  const clipId = parseInt(params.clipId as string);
  const [selectedTeam] = useAtom(selectedTeamAtom);

  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("captions");

  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const [textOverlay, setTextOverlay] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(10);
  const [fontSize, setFontSize] = useState(48);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTeam?.id && clipId) {
      loadClip();
    }
  }, [selectedTeam?.id, clipId]);

  const loadClip = async () => {
    if (!selectedTeam?.id) return;
    setLoading(true);
    try {
      const data = await clipsAPI.getClip(selectedTeam.id, clipId);
      setClip(data);
      if (data.captions_data) {
        setCaptions(JSON.parse(JSON.stringify(data.captions_data)));
      }
    } catch (error) {
      console.error("Failed to load clip:", error);
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

  const handleSaveCaptions = async () => {
    if (!selectedTeam?.id || !clip) return;
    setSaving(true);
    try {
      const metadata = clip.clip_metadata as any;
      const captionColor = metadata?.parameters?.captionColor;
      const result = await clipsAPI.updateCaptions(
        selectedTeam.id,
        clip.id,
        captions,
        captionColor
      );
      setClip((prev) =>
        prev ? { ...prev, clipUrl: result.clipUrl, captions_data: result.captionsData } : null
      );
      addToast({
        title: "Captions saved",
        description: "Your caption changes have been applied to the video.",
        color: "success",
      });
    } catch (error) {
      console.error("Failed to save captions:", error);
      addToast({
        title: "Failed to save",
        description: "Something went wrong. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTextOverlay = async () => {
    if (!selectedTeam?.id || !clip || !textOverlay.trim()) return;
    setSaving(true);
    try {
      const result = await clipsAPI.updateTextOverlay(selectedTeam.id, clip.id, {
        text: textOverlay,
        color: textColor,
        x: textX,
        y: textY,
        fontSize,
      });
      setClip((prev) => (prev ? { ...prev, clipUrl: result.clipUrl } : null));
      addToast({
        title: "Text overlay applied",
        description: "Your text overlay has been added to the video.",
        color: "success",
      });
    } catch (error) {
      console.error("Failed to save text overlay:", error);
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
                  {activeTab === "text" && textOverlay && (
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
                        fontFamily: "Montserrat, sans-serif",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      {textOverlay}
                    </div>
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

          <div className="bg-surface-base border border-border-base rounded-xl p-4">
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as string)}
              classNames={{
                tabList: "bg-surface-elevated",
                cursor: "bg-accent-400",
                tab: "text-text-secondary",
                tabContent: "group-data-[selected=true]:text-white",
              }}
            >
              <Tab
                key="captions"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:subtitles-outline" />
                    <span>Captions</span>
                  </div>
                }
              >
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-text-secondary">
                      {captions.length} caption segments
                    </p>
                    <Button
                      color="primary"
                      size="sm"
                      onPress={handleSaveCaptions}
                      isDisabled={saving || captions.length === 0}
                      startContent={
                        saving ? <Spinner size="sm" /> : <Icon icon="solar:diskette-bold" />
                      }
                    >
                      {saving ? "Saving..." : "Save Captions"}
                    </Button>
                  </div>

                  <div className="h-[50vh] overflow-y-auto space-y-2 pr-2">
                    {captions.map((caption, index) => (
                      <div
                        key={caption.index}
                        className={`p-3 rounded-lg border transition-all ${
                          isActiveCaption(caption)
                            ? "bg-accent-400/10 border-accent-400"
                            : "bg-surface-elevated border-border-base"
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
                          classNames={{
                            inputWrapper: "bg-surface-base border-border-base",
                          }}
                        />
                      </div>
                    ))}

                    {captions.length === 0 && (
                      <div className="text-center py-12">
                        <Icon
                          icon="solar:subtitles-outline"
                          className="text-4xl text-text-tertiary mb-2 mx-auto"
                        />
                        <p className="text-text-secondary">No captions available</p>
                      </div>
                    )}
                  </div>
                </div>
              </Tab>

              <Tab
                key="text"
                title={
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:text-bold" />
                    <span>Text Overlay</span>
                  </div>
                }
              >
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">Text</label>
                    <Textarea
                      value={textOverlay}
                      onChange={(e) => setTextOverlay(e.target.value)}
                      placeholder="Enter text overlay..."
                      variant="bordered"
                      minRows={2}
                      maxRows={4}
                      classNames={{
                        inputWrapper: "bg-surface-base border-border-base",
                        input: "text-base",
                      }}
                    />
                  </div>

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
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${
                            textColor === preset.color
                              ? "border-accent-400 scale-110"
                              : "border-border-base hover:border-accent-400/50"
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
                          className="absolute inset-0 w-10 h-10 opacity-0 cursor-pointer"
                        />
                        <div
                          className="w-10 h-10 rounded-lg border-2 border-border-base flex items-center justify-center bg-surface-elevated hover:border-accent-400/50 transition-all"
                          title="Custom color"
                        >
                          <Icon icon="solar:palette-bold" className="text-text-secondary" />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-text-tertiary mt-2">Selected: {textColor}</p>
                  </div>

                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">
                      Horizontal Position: {textX}%
                    </label>
                    <Slider
                      value={textX}
                      onChange={(val) => setTextX(val as number)}
                      minValue={0}
                      maxValue={100}
                      step={1}
                      classNames={{
                        track: "bg-surface-elevated",
                        filler: "bg-accent-400",
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">
                      Vertical Position: {textY}%
                    </label>
                    <Slider
                      value={textY}
                      onChange={(val) => setTextY(val as number)}
                      minValue={0}
                      maxValue={100}
                      step={1}
                      classNames={{
                        track: "bg-surface-elevated",
                        filler: "bg-accent-400",
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-text-secondary mb-2 block">
                      Font Size: {fontSize}px
                    </label>
                    <Slider
                      value={fontSize}
                      onChange={(val) => setFontSize(val as number)}
                      minValue={16}
                      maxValue={120}
                      step={2}
                      classNames={{
                        track: "bg-surface-elevated",
                        filler: "bg-accent-400",
                      }}
                    />
                  </div>

                  <Button
                    color="primary"
                    className="w-full"
                    onPress={handleSaveTextOverlay}
                    isDisabled={saving || !textOverlay.trim()}
                    startContent={
                      saving ? <Spinner size="sm" /> : <Icon icon="solar:diskette-bold" />
                    }
                  >
                    {saving ? "Saving..." : "Apply Text Overlay"}
                  </Button>
                </div>
              </Tab>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
