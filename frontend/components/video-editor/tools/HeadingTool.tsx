"use client";

import React, { useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { TextArea, Slider, Button, TextField, Label } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  headingStateAtom,
  editorClipAtom,
  HeadingState,
  HeadingStyle,
} from "@/store/videoEditor";
import { selectedTeamAtom } from "@/store/auth";
import {
  HEADING_COLOR_PRESETS,
  HEADING_FONTS,
  HEADING_STYLES,
} from "@/constants/overlayStyles";
import { clipsAPI } from "@/api/clips";

const DEFAULT_HEADING: HeadingState = {
  text: "",
  color: "#FFFFFF",
  font: "Montserrat",
  x: 50,
  y: 10,
  fontSize: 48,
  style: "stroke",
  headingBgColor: "#000000",
};

export function HeadingTool() {
  const [headingState, setHeadingState] = useAtom(headingStateAtom);
  const [isGenerating, setIsGenerating] = useState(false);
  const clip = useAtomValue(editorClipAtom);
  const selectedTeam = useAtomValue(selectedTeamAtom);

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

  const handleAIGenerate = async () => {
    if (!clip || !selectedTeam?.id) return;
    setIsGenerating(true);
    try {
      const result = await clipsAPI.generateHeading(selectedTeam.id, clip.id);
      updateHeading({ text: result.heading });
    } catch (error) {
      console.error("Failed to generate heading:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="solar:text-bold" className="text-accent-400" />
          Heading Overlay
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Add a text heading to your video
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-text-secondary">Heading Text</label>
          <Button
            size="sm"
            variant="tertiary"
            isPending={isGenerating}
            onPress={handleAIGenerate}
          >
            {!isGenerating && <Icon icon="solar:magic-stick-3-bold" />}
            AI Generate
          </Button>
        </div>
        <TextField fullWidth variant="secondary">
          <Label>Heading Text</Label>
          <TextArea
            value={heading.text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter heading or use AI Generate..."
            rows={2}
          />
        </TextField>
      </div>

      {heading.text.trim() && (
        <>
          <div>
            <label className="text-sm text-text-secondary mb-2 block">
              Style
            </label>
            <div className="flex gap-2">
              {HEADING_STYLES.map((s) => (
                <Button
                  key={s.key}
                  onPress={() =>
                    updateHeading({
                      style: s.key as HeadingStyle,
                      font: s.key === "instagram" ? "Proxima Nova" : heading.font,
                      ...(s.key === "instagram"
                        ? { color: (heading.headingBgColor || "#000000") === "#FFFFFF" ? "#000000" : "#FFFFFF" }
                        : {}),
                    })
                  }
                  className={`flex-1 h-10 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm ${
                    heading.style === s.key
                      ? "bg-white text-black border-white"
                      : "bg-surface-base text-white border-border-base hover:border-accent-400/50"
                  }`}
                >
                  <Icon icon={s.icon} />
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {heading.style !== "instagram" ? (
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Text Color
              </label>
              <div className="flex flex-wrap gap-2">
                {HEADING_COLOR_PRESETS.map((preset) => (
                  <div
                    key={preset.color}
                    onClick={() => updateHeading({ color: preset.color })}
                    className={`w-8 h-8 rounded-lg cursor-pointer transition-all ${
                      heading.color === preset.color
                        ? "ring-2 ring-accent-400 ring-offset-2 ring-offset-[#0f0f1a] scale-110"
                        : "hover:scale-110"
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
                    className="w-8 h-8 rounded-lg border-2 border-border-base flex items-center justify-center bg-white/[0.04]"
                    title="Custom color"
                  >
                    <Icon
                      icon="solar:palette-bold"
                      className="text-text-secondary text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm text-text-secondary mb-2 block">
                Background Color
              </label>
              <div className="flex gap-2">
                <Button
                  onPress={() =>
                    updateHeading({ headingBgColor: "#000000", color: "#FFFFFF" })
                  }
                  className={`flex-1 h-10 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm ${
                    (heading.headingBgColor || "#000000") === "#000000"
                      ? "bg-black text-white border-accent-400"
                      : "bg-black/60 text-white/60 border-border-base hover:border-accent-400/50"
                  }`}
                >
                  Black
                </Button>
                <Button
                  onPress={() =>
                    updateHeading({ headingBgColor: "#FFFFFF", color: "#000000" })
                  }
                  className={`flex-1 h-10 rounded-lg border transition-all flex items-center justify-center gap-2 text-sm ${
                    heading.headingBgColor === "#FFFFFF"
                      ? "bg-white text-black border-accent-400"
                      : "bg-white/60 text-black/60 border-border-base hover:border-accent-400/50"
                  }`}
                >
                  White
                </Button>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-text-secondary mb-2 block">
              Font
            </label>
            <div className="flex gap-2 overflow-x-auto py-1">
              {HEADING_FONTS.map((font) => (
                <Button
                  key={font.id}
                  isIconOnly
                  onPress={() => updateHeading({ font: font.name })}
                  className={`h-10 w-10 rounded-lg border transition-all flex items-center justify-center flex-shrink-0 ${
                    heading.font === font.name
                      ? "bg-white text-black border-white scale-105"
                      : "bg-surface-base text-white border-border-base hover:scale-105"
                  }`}
                  aria-label={font.name}
                >
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: `var(--font-${font.id})` }}
                  >
                    Ag
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              Font Size: {heading.fontSize}px
            </label>
            <Slider
              value={heading.fontSize}
              onChange={(val) => updateHeading({ fontSize: val as number })}
              minValue={16}
              maxValue={120}
              step={2}
            >
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
          </div>

          <Button
            variant="danger-soft"
            className="w-full"
            onPress={handleClear}
          >
            <Icon icon="solar:trash-bin-trash-bold" />
            Remove Heading
          </Button>
        </>
      )}

      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon
            icon="solar:info-circle-bold"
            className="text-sm mt-0.5 flex-shrink-0"
          />
          <span>
            The heading will appear as a text overlay on your video. Supports
            emojis! Use the position sliders to place it exactly where you want.
          </span>
        </p>
      </div>
    </div>
  );
}
