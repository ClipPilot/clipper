"use client";

import React from "react";
import { useAtom } from "jotai";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { cropStateAtom, ASPECT_RATIO_PRESETS, AspectRatio } from "@/store/videoEditor";

export function CropTool() {
  const [cropState, setCropState] = useAtom(cropStateAtom);

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setCropState({ aspectRatio: ratio, customCrop: undefined });
  };

  const getAspectRatioIcon = (ratio: AspectRatio) => {
    switch (ratio) {
      case "9:16":
        return "solar:smartphone-bold";
      case "16:9":
        return "solar:monitor-bold";
      case "1:1":
        return "solar:square-bold";
      case "4:5":
        return "solar:gallery-bold";
      default:
        return "solar:crop-bold";
    }
  };

  const getAspectRatioDescription = (ratio: AspectRatio) => {
    switch (ratio) {
      case "9:16":
        return "TikTok, Reels, Shorts";
      case "16:9":
        return "YouTube, Landscape";
      case "1:1":
        return "Instagram Feed";
      case "4:5":
        return "Instagram Portrait";
      default:
        return "Custom crop";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-accent flex items-center gap-2">
          <Icon icon="solar:crop-bold" className="text-accent-400" />
          Crop & Resize
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Change the aspect ratio of your video
        </p>
      </div>

      {/* Current Selection */}
      <div className="bg-surface-elevated rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-accent-400/20 flex items-center justify-center">
            <Icon
              icon={getAspectRatioIcon(cropState.aspectRatio)}
              className="text-2xl text-accent-400"
            />
          </div>
          <div>
            <p className="text-text-accent font-medium">{cropState.aspectRatio}</p>
            <p className="text-xs text-text-tertiary">
              {getAspectRatioDescription(cropState.aspectRatio)}
            </p>
          </div>
        </div>
        {cropState.aspectRatio !== "9:16" && (
          <Button
 size="sm"
 variant="tertiary"
 onPress={() => handleAspectRatioChange("9:16")}
 >
            Reset
          </Button>
        )}
      </div>

      {/* Aspect Ratio Grid */}
      <div>
        <label className="text-sm text-text-secondary mb-3 block">Select Aspect Ratio</label>
        <div className="grid grid-cols-2 gap-3">
          {ASPECT_RATIO_PRESETS.map((preset) => {
            const isSelected = cropState.aspectRatio === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => handleAspectRatioChange(preset.value)}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-accent-400 bg-accent-400/10"
                    : "border-border-base bg-surface-elevated hover:border-accent-400/50"
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Icon
                    icon={getAspectRatioIcon(preset.value)}
                    className={`text-2xl ${isSelected ? "text-accent-400" : "text-text-secondary"}`}
                  />
                  <span
                    className={`font-semibold ${
                      isSelected ? "text-accent-400" : "text-text-accent"
                    }`}
                  >
                    {preset.label}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {getAspectRatioDescription(preset.value)}
                  </span>
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Icon icon="solar:check-circle-bold" className="text-accent-400" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Info */}
      <div className="bg-surface-elevated rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Icon icon="solar:info-circle-bold" className="text-text-tertiary" />
          <span className="text-text-secondary">Preview shows how content will be cropped</span>
        </div>
        {cropState.aspectRatio !== "9:16" && (
          <p className="text-xs text-yellow-400">
            Note: Content outside the new aspect ratio will be removed
          </p>
        )}
      </div>

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            Your original video is 9:16 (vertical). Changing to a different ratio will
            crop the content to fit. This cannot be undone after processing.
          </span>
        </p>
      </div>
    </div>
  );
}
