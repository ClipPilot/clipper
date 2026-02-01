"use client";

import React from "react";
import { useAtom } from "jotai";
import { Textarea, Slider, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { headingStateAtom, HeadingState } from "@/store/videoEditor";
import { HEADING_COLOR_PRESETS, HEADING_FONTS } from "@/constants/overlayStyles";

const DEFAULT_HEADING: HeadingState = {
  text: "",
  color: "#FFFFFF",
  font: "Montserrat",
  x: 50,
  y: 10,
  fontSize: 48,
};

export function HeadingTool() {
  const [headingState, setHeadingState] = useAtom(headingStateAtom);

  const heading = headingState || DEFAULT_HEADING;

  const updateHeading = (updates: Partial<HeadingState>) => {
    setHeadingState((prev) => ({
      ...(prev || DEFAULT_HEADING),
      ...updates,
    }));
  };

  const handleTextChange = (text: string) => {
    if (text.trim()) {
      updateHeading({ text });
    } else {
      setHeadingState(null);
    }
  };

  const handleClear = () => {
    setHeadingState(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="solar:text-bold" className="text-accent-400" />
          Heading Overlay
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Add a text heading to your video
        </p>
      </div>

      {/* Text Input */}
      <div>
        <label className="text-sm text-text-secondary mb-2 block">Heading Text</label>
        <Textarea
          value={heading.text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter heading (optional)..."
          variant="bordered"
          minRows={2}
          maxRows={3}
          classNames={{
            inputWrapper: "bg-surface-elevated border-border-base",
            input: "text-base",
          }}
        />
      </div>

      {/* Only show options if text is entered */}
      {heading.text.trim() && (
        <>
          {/* Color Selection */}
          <div>
            <label className="text-sm text-text-secondary mb-2 block">Text Color</label>
            <div className="flex flex-wrap gap-2">
              {HEADING_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => updateHeading({ color: preset.color })}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    heading.color === preset.color
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
                  value={heading.color}
                  onChange={(e) => updateHeading({ color: e.target.value })}
                  className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                />
                <div
                  className="w-8 h-8 rounded-lg border-2 border-border-base flex items-center justify-center bg-surface-elevated"
                  title="Custom color"
                >
                  <Icon icon="solar:palette-bold" className="text-text-secondary text-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Font Selection */}
          <div>
            <label className="text-sm text-text-secondary mb-2 block">Font</label>
            <div className="flex gap-2 overflow-x-auto py-1">
              {HEADING_FONTS.map((font) => (
                <button
                  key={font.id}
                  onClick={() => updateHeading({ font: font.name })}
                  className={`h-10 w-10 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 ${
                    heading.font === font.name
                      ? "bg-white text-black border-white scale-105"
                      : "bg-surface-base text-white border-border-base hover:scale-105"
                  }`}
                  title={font.name}
                >
                  <span className="text-sm font-bold" style={{ fontFamily: `var(--font-${font.id})` }}>
                    Ag
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Position Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">X Position: {heading.x}%</label>
              <Slider
                value={heading.x}
                onChange={(val) => updateHeading({ x: val as number })}
                minValue={0}
                maxValue={100}
                step={1}
                color="secondary"
                size="sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary mb-1 block">Y Position: {heading.y}%</label>
              <Slider
                value={heading.y}
                onChange={(val) => updateHeading({ y: val as number })}
                minValue={0}
                maxValue={100}
                step={1}
                color="secondary"
                size="sm"
              />
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Font Size: {heading.fontSize}px</label>
            <Slider
              value={heading.fontSize}
              onChange={(val) => updateHeading({ fontSize: val as number })}
              minValue={16}
              maxValue={120}
              step={2}
              color="secondary"
              size="sm"
            />
          </div>

          {/* Clear Button */}
          <Button
            variant="flat"
            color="danger"
            className="w-full"
            onPress={handleClear}
            startContent={<Icon icon="solar:trash-bin-trash-bold" />}
          >
            Remove Heading
          </Button>
        </>
      )}

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            The heading will appear as a text overlay on your video.
            Use the position sliders to place it exactly where you want.
          </span>
        </p>
      </div>
    </div>
  );
}
