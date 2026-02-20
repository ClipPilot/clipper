"use client";

import React from "react";
import { Button, Input, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  EXTENDED_COLORS,
  CAPTION_FONTS,
  HEADING_FONTS,
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
  captions: boolean;
  setCaptions: (value: boolean) => void;
  captionColor: string;
  setCaptionColor: (value: string) => void;
  captionFont: string;
  setCaptionFont: (value: string) => void;
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
  captions,
  setCaptions,
  captionColor,
  setCaptionColor,
  captionFont,
  setCaptionFont,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-text-primary">Overlays & Captions</h3>

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

      <div className="p-4 rounded-lg bg-surface-elevated border border-border-base">
        <p className="font-medium text-text-primary mb-4">Heading (Optional)</p>

        <Input
          label="Custom Text"
          placeholder="e.g., MUST WATCH, NEW PRODUCT ALERT"
          value={customText}
          onValueChange={setCustomText}
          classNames={{ inputWrapper: "bg-surface-dark" }}
        />

        {customText && (
          <>
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

            <div className="mt-4">
              <label className="text-sm font-medium text-text-primary mb-3 block">Text Font</label>
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
    </div>
  );
};
