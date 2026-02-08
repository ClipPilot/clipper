"use client";

import React from "react";
import { useAtom, useAtomValue } from "jotai";
import { Input, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  captionsEnabledAtom,
  captionsDataAtom,
  captionColorAtom,
  captionFontAtom,
  currentTimeAtom,
} from "@/store/videoEditor";
import { OVERLAY_COLORS, CAPTION_FONTS } from "@/constants/overlayStyles";
import { CaptionEntry } from "@/api/clips";

export function CaptionsTool() {
  const [captionsEnabled, setCaptionsEnabled] = useAtom(captionsEnabledAtom);
  const [captions, setCaptions] = useAtom(captionsDataAtom);
  const [captionColor, setCaptionColor] = useAtom(captionColorAtom);
  const [captionFont, setCaptionFont] = useAtom(captionFontAtom);
  const currentTime = useAtomValue(currentTimeAtom);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, "0")}`;
  };

  const isActiveCaption = (caption: CaptionEntry): boolean => {
    return currentTime >= caption.startTime && currentTime < caption.endTime;
  };

  const handleCaptionTextChange = (index: number, text: string) => {
    setCaptions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, text } : c))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="solar:subtitles-bold" className="text-accent-400" />
          Captions
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Edit caption text and styling
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      {captions.length > 0 && (
        <div className="bg-surface-elevated rounded-lg p-4">
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

      {/* Caption Style */}
      {captions.length > 0 && captionsEnabled && (
        <div className="bg-surface-elevated rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium text-text-primary">Caption Style</p>

          {/* Highlight Color */}
          <div>
            <label className="text-xs text-text-secondary mb-2 block">Highlight Color</label>
            <div className="flex flex-wrap gap-2">
              {OVERLAY_COLORS.map((c) => (
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

          {/* Font */}
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
                  <span className="text-base font-bold" style={{ fontFamily: `var(--font-${font.id})` }}>
                    Ag
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Caption List */}
      <div>
        <p className="text-sm text-text-secondary mb-2">{captions.length} caption segments</p>
        <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2">
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
                <span className="flex items-center gap-2 text-xs text-text-tertiary">
                  <Icon icon="solar:play-circle-outline" />
                  {formatTime(caption.startTime)} - {formatTime(caption.endTime)}
                </span>
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

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            Edit caption text directly. The highlight color shows which word is currently
            being spoken during playback.
          </span>
        </p>
      </div>
    </div>
  );
}
