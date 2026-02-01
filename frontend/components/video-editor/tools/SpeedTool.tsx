"use client";

import React from "react";
import { useAtom, useAtomValue } from "jotai";
import { Slider, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  speedStateAtom,
  SPEED_PRESETS,
  trimStateAtom,
  finalDurationAtom,
} from "@/store/videoEditor";

export function SpeedTool() {
  const [speed, setSpeed] = useAtom(speedStateAtom);
  const trimState = useAtomValue(trimStateAtom);
  const finalDuration = useAtomValue(finalDurationAtom);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const trimmedDuration = trimState.endTime - trimState.startTime;

  const getSpeedIcon = () => {
    if (speed < 1) return "solar:rewind-back-bold";
    if (speed > 1) return "solar:rewind-forward-bold";
    return "solar:play-bold";
  };

  const getSpeedLabel = () => {
    if (speed < 1) return "Slow Motion";
    if (speed > 1) return "Fast Forward";
    return "Normal Speed";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Icon icon="solar:speedometer-bold" className="text-accent-400" />
          Playback Speed
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Adjust the playback speed of your video
        </p>
      </div>

      {/* Speed Display */}
      <div className="bg-surface-elevated rounded-lg p-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Icon icon={getSpeedIcon()} className="text-3xl text-accent-400" />
          <span className="text-4xl font-bold text-text-primary">{speed}x</span>
        </div>
        <p className="text-sm text-text-secondary">{getSpeedLabel()}</p>
      </div>

      {/* Speed Slider */}
      <div>
        <label className="text-sm text-text-secondary mb-2 block">Fine Adjustment</label>
        <Slider
          value={speed}
          onChange={(val) => setSpeed(val as number)}
          minValue={0.25}
          maxValue={4}
          step={0.05}
          color="secondary"
          size="md"
          showTooltip
          formatOptions={{ style: "decimal", minimumFractionDigits: 2 }}
          classNames={{
            track: "bg-surface-elevated",
          }}
        />
        <div className="flex justify-between text-xs text-text-tertiary mt-1">
          <span>0.25x</span>
          <span>1x</span>
          <span>2x</span>
          <span>4x</span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div>
        <label className="text-sm text-text-secondary mb-2 block">Presets</label>
        <div className="grid grid-cols-3 gap-2">
          {SPEED_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              size="sm"
              variant={speed === preset.value ? "solid" : "flat"}
              color={speed === preset.value ? "primary" : "default"}
              onPress={() => setSpeed(preset.value)}
              className="font-mono"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Duration Info */}
      <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Trimmed Duration</span>
          <span className="text-sm text-text-primary font-mono">{formatTime(trimmedDuration)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">After Speed Change</span>
          <span className="text-sm text-accent-400 font-mono font-semibold">
            {formatTime(finalDuration)}
          </span>
        </div>
        {speed !== 1 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-tertiary">Time Difference</span>
            <span className={speed > 1 ? "text-green-400" : "text-yellow-400"}>
              {speed > 1 ? "-" : "+"}
              {formatTime(Math.abs(trimmedDuration - finalDuration))}
            </span>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            Speed changes are previewed in real-time. The audio pitch will be adjusted
            to match the new speed in the final render.
          </span>
        </p>
      </div>
    </div>
  );
}
