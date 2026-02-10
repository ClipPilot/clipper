"use client";

import React from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Slider, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  speedStateAtom,
  SPEED_PRESETS,
  trimStateAtom,
  finalDurationAtom,
  selectedSegmentAtom,
  activeSegmentsAtom,
  updateSegmentSpeedAtom,
  updateAllSegmentsSpeedAtom,
} from "@/store/videoEditor";

export function SpeedTool() {
  const [globalSpeed, setGlobalSpeed] = useAtom(speedStateAtom);
  const trimState = useAtomValue(trimStateAtom);
  const finalDuration = useAtomValue(finalDurationAtom);
  const selectedSegment = useAtomValue(selectedSegmentAtom);
  const activeSegments = useAtomValue(activeSegmentsAtom);
  const updateSegmentSpeed = useSetAtom(updateSegmentSpeedAtom);
  const updateAllSegmentsSpeed = useSetAtom(updateAllSegmentsSpeedAtom);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Current speed: selected segment's speed or global speed
  const currentSpeed = selectedSegment?.speed ?? globalSpeed;

  // Handle speed change
  const handleSpeedChange = (newSpeed: number) => {
    if (selectedSegment) {
      // Apply to selected segment only
      updateSegmentSpeed({ segmentId: selectedSegment.id, speed: newSpeed });
    } else if (activeSegments.length > 0) {
      // Apply to all segments
      updateAllSegmentsSpeed(newSpeed);
    } else {
      // Fallback to global speed
      setGlobalSpeed(newSpeed);
    }
  };

  // Calculate segment duration
  const getSegmentDuration = (startTime: number, endTime: number, speed: number) => {
    return (endTime - startTime) / speed;
  };

  const trimmedDuration = trimState.endTime - trimState.startTime;

  const getSpeedIcon = () => {
    if (currentSpeed < 1) return "solar:rewind-back-bold";
    if (currentSpeed > 1) return "solar:rewind-forward-bold";
    return "solar:play-bold";
  };

  const getSpeedLabel = () => {
    if (currentSpeed < 1) return "Slow Motion";
    if (currentSpeed > 1) return "Fast Forward";
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
        {selectedSegment ? (
          <p className="text-sm text-accent-400 mt-1 flex items-center gap-1">
            <Icon icon="solar:check-circle-bold" className="text-xs" />
            Editing selected segment ({formatTime(selectedSegment.startTime)} -{" "}
            {formatTime(selectedSegment.endTime)})
          </p>
        ) : activeSegments.length > 1 ? (
          <p className="text-sm text-text-tertiary mt-1">
            Select a segment on the timeline to set individual speed, or apply to all
          </p>
        ) : (
          <p className="text-sm text-text-tertiary mt-1">
            Adjust the playback speed of your video
          </p>
        )}
      </div>

      {/* Speed Display */}
      <div className="bg-surface-elevated rounded-lg p-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Icon icon={getSpeedIcon()} className="text-3xl text-accent-400" />
          <span className="text-4xl font-bold text-text-primary">{currentSpeed}x</span>
        </div>
        <p className="text-sm text-text-secondary">{getSpeedLabel()}</p>
      </div>

      {/* Speed Slider */}
      <div>
        <label className="text-sm text-text-secondary mb-2 block">Fine Adjustment</label>
        <Slider
          value={currentSpeed}
          onChange={(val) => handleSpeedChange(val as number)}
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
              variant={currentSpeed === preset.value ? "solid" : "flat"}
              color={currentSpeed === preset.value ? "primary" : "default"}
              onPress={() => handleSpeedChange(preset.value)}
              className="font-mono"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Duration Info - Segment specific */}
      {selectedSegment && (
        <div className="bg-accent-400/10 border border-accent-400/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="solar:alt-arrow-right-bold" className="text-accent-400" />
            <span className="text-sm font-medium text-accent-400">Selected Segment</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Original Duration</span>
            <span className="text-sm text-text-primary font-mono">
              {formatTime(selectedSegment.endTime - selectedSegment.startTime)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">After Speed Change</span>
            <span className="text-sm text-accent-400 font-mono font-semibold">
              {formatTime(
                getSegmentDuration(
                  selectedSegment.startTime,
                  selectedSegment.endTime,
                  selectedSegment.speed
                )
              )}
            </span>
          </div>
        </div>
      )}

      {/* Duration Info - Global */}
      {!selectedSegment && (
        <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Total Duration</span>
            <span className="text-sm text-text-primary font-mono">{formatTime(trimmedDuration)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">After Speed Changes</span>
            <span className="text-sm text-accent-400 font-mono font-semibold">
              {formatTime(finalDuration)}
            </span>
          </div>
          {Math.abs(trimmedDuration - finalDuration) > 0.1 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-tertiary">Time Difference</span>
              <span className={finalDuration < trimmedDuration ? "text-green-400" : "text-yellow-400"}>
                {finalDuration < trimmedDuration ? "-" : "+"}
                {formatTime(Math.abs(trimmedDuration - finalDuration))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Segment Speed Summary */}
      {activeSegments.length > 1 && (
        <div className="bg-surface-elevated rounded-lg p-4">
          <p className="text-xs text-text-tertiary mb-3 flex items-center gap-1">
            <Icon icon="solar:list-bold" className="text-sm" />
            Segment Speeds
          </p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {activeSegments.map((segment, index) => (
              <div
                key={segment.id}
                className={`flex justify-between items-center p-2 rounded text-sm ${
                  segment.id === selectedSegment?.id
                    ? "bg-accent-400/20 border border-accent-400/30"
                    : "bg-surface-base"
                }`}
              >
                <span className="text-text-secondary">
                  Segment {index + 1}
                  <span className="text-text-tertiary text-xs ml-1">
                    ({formatTime(segment.startTime)} - {formatTime(segment.endTime)})
                  </span>
                </span>
                <span
                  className={`font-mono ${
                    segment.speed !== 1.0 ? "text-accent-400" : "text-text-primary"
                  }`}
                >
                  {segment.speed}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            {selectedSegment
              ? "Speed changes apply only to the selected segment. Click elsewhere on the timeline to deselect."
              : "Split the video (press S at playhead) to create segments with different speeds."}
          </span>
        </p>
      </div>
    </div>
  );
}
