"use client";

import React, { useRef, useState } from "react";
import { Button, Input, Switch, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  EXTENDED_COLORS,
  CAPTION_FONTS,
  HEADING_FONTS,
  HEADING_STYLES,
  TEXT_POSITIONS,
  TextPosition,
} from "@/constants/overlayStyles";

interface TextOverlayPanelProps {
  customText: string;
  setCustomText: (value: string) => void;
  textPosition: TextPosition;
  setTextPosition: (value: TextPosition) => void;
  textColor: string;
  setTextColor: (value: string) => void;
  textFont: string;
  setTextFont: (value: string) => void;
  textStyle: "stroke" | "instagram";
  setTextStyle: (value: "stroke" | "instagram") => void;
  autoHeading: boolean;
  setAutoHeading: (value: boolean) => void;
  captions: boolean;
  setCaptions: (value: boolean) => void;
  captionColor: string;
  setCaptionColor: (value: string) => void;
  captionFont: string;
  setCaptionFont: (value: string) => void;
  musicFile: File | null;
  setMusicFile: (value: File | null) => void;
  musicS3Key: string;
  setMusicS3Key: (value: string) => void;
  musicFileName: string;
  setMusicFileName: (value: string) => void;
  onMusicUpload: (file: File) => Promise<void>;
  isMusicUploading: boolean;
}

export const TextOverlayPanel: React.FC<TextOverlayPanelProps> = ({
  customText,
  setCustomText,
  textPosition,
  setTextPosition,
  textColor,
  setTextColor,
  textFont,
  setTextFont,
  textStyle,
  setTextStyle,
  autoHeading,
  setAutoHeading,
  captions,
  setCaptions,
  captionColor,
  setCaptionColor,
  captionFont,
  setCaptionFont,
  musicFile,
  setMusicFile,
  musicS3Key,
  setMusicS3Key,
  musicFileName,
  setMusicFileName,
  onMusicUpload,
  isMusicUploading,
}) => {
  const musicInputRef = useRef<HTMLInputElement>(null);

  const handleMusicSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["audio/mpeg", "audio/wav", "audio/aac", "audio/mp4", "audio/x-m4a"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload an MP3, WAV, or AAC file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setMusicFile(file);
    setMusicFileName(file.name);
    await onMusicUpload(file);
  };

  const handleRemoveMusic = () => {
    setMusicFile(null);
    setMusicS3Key("");
    setMusicFileName("");
    if (musicInputRef.current) musicInputRef.current.value = "";
  };

  // Show heading style/color/font options when either custom text is entered or auto-heading is on
  const showHeadingOptions = !!customText || autoHeading;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-text-primary">Overlays & Captions</h3>

      {/* Captions Section */}
      <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-text-primary">Auto Captions</p>
            <p className="text-sm text-text-secondary">Show captions with highlighted current word</p>
          </div>
          <Switch isSelected={captions} onValueChange={setCaptions} color="primary" />
        </div>

        {captions && (
          <>
            <div>
              <label className="text-sm font-medium text-text-primary mb-3 block">Highlight Color</label>
              <div className="grid grid-cols-8 gap-2">
                {EXTENDED_COLORS.map((c) => (
                  <button
                    key={`caption-${c.color}`}
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
            <div className="mt-6">
              <label className="text-sm font-medium text-text-primary mb-3 block">Caption Font</label>
              <div className="flex gap-3 overflow-x-auto py-2 px-1">
                {CAPTION_FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => setCaptionFont(font.name)}
                    className={`h-14 w-14 rounded-xl border transition-all flex items-center justify-center ${
                      captionFont === font.name
                        ? "bg-accent-400 text-white border-accent-400 scale-105"
                        : "bg-surface-elevated text-text-primary border-border-base hover:scale-105"
                    }`}
                    title={font.name}
                  >
                    <span className="text-lg" style={{ fontFamily: `var(--font-${font.id})` }}>
                      Ag
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Heading Section */}
      <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
        <p className="font-medium text-text-primary mb-4">Heading</p>

        {/* Auto-heading toggle — hidden when custom text is entered */}
        {!customText && (
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-text-primary">Auto-Generate Headings</p>
              <p className="text-xs text-text-secondary">AI creates a viral heading for each clip</p>
            </div>
            <Switch isSelected={autoHeading} onValueChange={setAutoHeading} color="primary" size="sm" />
          </div>
        )}

        <Input
          label="Custom Text (Optional)"
          placeholder="e.g., MUST WATCH, NEW PRODUCT ALERT"
          value={customText}
          onValueChange={setCustomText}
          classNames={{ inputWrapper: "bg-surface-dark" }}
          description={customText ? "Custom text overrides auto-generated headings" : undefined}
        />

        {showHeadingOptions && (
          <>
            {/* Heading Style Toggle */}
            <div className="mt-4">
              <label className="text-sm font-medium text-text-primary mb-3 block">Heading Style</label>
              <div className="grid grid-cols-2 gap-3">
                {HEADING_STYLES.map((s) => (
                  <Button
                    key={s.key}
                    variant={textStyle === s.key ? "solid" : "bordered"}
                    color={textStyle === s.key ? "primary" : "default"}
                    onPress={() => setTextStyle(s.key)}
                    startContent={<Icon icon={s.icon} />}
                    size="sm"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Text Position — only for custom text */}
            {customText && (
              <div className="mt-4">
                <label className="text-sm font-medium text-text-primary mb-3 block">Text Position</label>
                <div className="grid grid-cols-3 gap-3">
                  {TEXT_POSITIONS.map((pos) => (
                    <Button
                      key={pos.key}
                      variant={textPosition === pos.key ? "solid" : "bordered"}
                      color={textPosition === pos.key ? "primary" : "default"}
                      onPress={() => setTextPosition(pos.key)}
                      startContent={<Icon icon={pos.icon} />}
                      size="sm"
                    >
                      {pos.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Text Color — hidden for instagram style */}
            {textStyle !== "instagram" && (
              <div className="mt-4">
                <label className="text-sm font-medium text-text-primary mb-3 block">Text Color</label>
                <div className="grid grid-cols-8 gap-2">
                  {EXTENDED_COLORS.map((c) => (
                    <button
                      key={`text-${c.color}`}
                      onClick={() => setTextColor(c.color)}
                      className={`h-8 w-8 rounded border-2 transition-all ${
                        textColor === c.color
                          ? "border-accent-400 ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-elevated scale-110"
                          : "border-border-base hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="text-sm font-medium text-text-primary mb-3 block">Heading Font</label>
              <div className="flex gap-3 overflow-x-auto py-2 px-1">
                {HEADING_FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => setTextFont(font.name)}
                    className={`h-14 w-14 rounded-xl border transition-all flex items-center justify-center ${
                      textFont === font.name
                        ? "bg-accent-400 text-white border-accent-400 scale-105"
                        : "bg-surface-elevated text-text-primary border-border-base hover:scale-105"
                    }`}
                    title={font.name}
                  >
                    <span className="text-lg" style={{ fontFamily: `var(--font-${font.id})` }}>
                      Ag
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Background Music Section */}
      <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="solar:music-notes-bold" className="text-text-secondary" />
          <p className="font-medium text-text-primary">Background Music (Optional)</p>
        </div>

        {musicS3Key || musicFileName ? (
          <div className="flex items-center justify-between bg-surface-base rounded-lg p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-accent-400/20 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:music-note-2-bold" className="text-accent-400" />
              </div>
              <p className="text-sm text-text-primary truncate">{musicFileName}</p>
            </div>
            <Button size="sm" variant="flat" color="danger" isIconOnly onPress={handleRemoveMusic}>
              <Icon icon="solar:trash-bin-trash-bold" />
            </Button>
          </div>
        ) : (
          <div>
            <input
              ref={musicInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/aac,audio/mp4,audio/x-m4a"
              className="hidden"
              onChange={handleMusicSelect}
            />
            <Button
              variant="bordered"
              className="w-full"
              onPress={() => musicInputRef.current?.click()}
              isLoading={isMusicUploading}
              startContent={!isMusicUploading && <Icon icon="solar:upload-bold" />}
            >
              {isMusicUploading ? "Uploading..." : "Upload Music"}
            </Button>
            <p className="text-xs text-text-tertiary mt-2 text-center">MP3, WAV, or AAC (max 50MB)</p>
          </div>
        )}
      </div>
    </div>
  );
};
