"use client";

import React from "react";
import { useAtom, useAtomValue } from "jotai";
import { Button, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  trimStateAtom,
  videoDurationAtom,
  finalDurationAtom,
} from "@/store/videoEditor";

export function TrimTool() {
  const [trimState, setTrimState] = useAtom(trimStateAtom);
  const duration = useAtomValue(videoDurationAtom);
  const finalDuration = useAtomValue(finalDurationAtom);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const parseTime = (timeStr: string): number | null => {
    const match = timeStr.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
    if (!match) return null;
    const mins = parseInt(match[1]);
    const secs = parseInt(match[2]);
    const ms = match[3] ? parseInt(match[3].padEnd(2, "0").slice(0, 2)) : 0;
    return mins * 60 + secs + ms / 100;
  };

  const handleStartTimeChange = (value: string) => {
    const time = parseTime(value);
    if (time !== null && time >= 0 && time < trimState.endTime) {
      setTrimState((prev) => ({ ...prev, startTime: time }));
    }
  };

  const handleEndTimeChange = (value: string) => {
    const time = parseTime(value);
    if (time !== null && time > trimState.startTime && time <= duration) {
      setTrimState((prev) => ({ ...prev, endTime: time }));
    }
  };

  const handleReset = () => {
    setTrimState({ startTime: 0, endTime: duration });
  };

  const trimmedAmount = duration - (trimState.endTime - trimState.startTime);
  const trimPercentage = duration > 0 ? (trimmedAmount / duration) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-text-accent flex items-center gap-2">
          <Icon icon="solar:scissors-bold" className="text-accent-400" />
          Trim Video
        </h3>
        <p className="text-sm text-text-tertiary mt-1">
          Drag the handles on the timeline to trim your video
        </p>
      </div>

      {/* Time Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Start Time</label>
          <Input
 value={formatTime(trimState.startTime)}
 onChange={(e) => handleStartTimeChange(e.target.value)}
 startContent={<Icon icon="solar:play-bold" className="text-text-tertiary text-sm" />}
 />
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">End Time</label>
          <Input
 value={formatTime(trimState.endTime)}
 onChange={(e) => handleEndTimeChange(e.target.value)}
 startContent={<Icon icon="solar:stop-bold" className="text-text-tertiary text-sm" />}
 />
        </div>
      </div>

      {/* Duration Info */}
      <div className="bg-surface-elevated rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Original Duration</span>
          <span className="text-sm text-text-accent font-mono">{formatTime(duration)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">New Duration</span>
          <span className="text-sm text-accent-400 font-mono font-semibold">
            {formatTime(trimState.endTime - trimState.startTime)}
          </span>
        </div>
        {trimmedAmount > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-tertiary">Trimmed</span>
            <span className="text-red-400">
              -{formatTime(trimmedAmount)} ({trimPercentage.toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <p className="text-xs text-text-tertiary">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          <Button
 size="sm"
 variant="tertiary"
 onPress={() => setTrimState((prev) => ({ ...prev, startTime: 0 }))}
 >
            Reset Start
          </Button>
          <Button
 size="sm"
 variant="tertiary"
 onPress={() => setTrimState((prev) => ({ ...prev, endTime: duration }))}
 >
            Reset End
          </Button>
          <Button
 size="sm"
 variant="tertiary"
 onPress={handleReset}
 >
            Reset All
          </Button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-accent-400/10 rounded-lg p-3">
        <p className="text-xs text-accent-400 flex items-start gap-2">
          <Icon icon="solar:info-circle-bold" className="text-sm mt-0.5 flex-shrink-0" />
          <span>
            Use the yellow handles on the timeline below the video to visually trim.
            The dark areas show what will be removed.
          </span>
        </p>
      </div>
    </div>
  );
}
