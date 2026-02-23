"use client";

import React from "react";
import {
  Select,
  SelectItem,
  Slider,
  Textarea,
  Card,
  CardBody,
  Switch,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  PromptType,
  PROMPT_TYPES,
  PROMPT_TYPE_LABELS,
  PROMPT_TYPE_PLACEHOLDERS,
} from "@/constants/promptTypes";
import type { ConversionMode } from "@/api/video";

const CONVERSION_MODE_OPTIONS: {
  key: ConversionMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "standard",
    label: "Standard",
    description: "Blurred background with centered video",
    icon: "solar:smartphone-bold-duotone",
  },
  {
    key: "gaming",
    label: "Gaming",
    description: "Facecam on top, gameplay on bottom",
    icon: "solar:gamepad-bold-duotone",
  },
  {
    key: "speaker-zoom",
    label: "Speaker Zoom",
    description: "Zooms into the speaker's face",
    icon: "solar:user-speak-bold-duotone",
  },
  {
    key: "center-crop",
    label: "Center Crop",
    description: "Tight center crop to 9:16",
    icon: "solar:crop-bold-duotone",
  },
];

interface SettingsPanelProps {
  promptType: PromptType;
  setPromptType: (value: PromptType) => void;
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  length: number;
  setLength: (value: number) => void;
  hookLength: number;
  setHookLength: (value: number) => void;
  numberOfVideos: number;
  setNumberOfVideos: (value: number) => void;
  maxClips?: number;
  batchMode?: boolean;
  conversionMode: ConversionMode;
  setConversionMode: (value: ConversionMode) => void;
  autoLength: boolean;
  setAutoLength: (value: boolean) => void;
  autoHookLength: boolean;
  setAutoHookLength: (value: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  promptType,
  setPromptType,
  customPrompt,
  setCustomPrompt,
  length,
  setLength,
  hookLength,
  setHookLength,
  numberOfVideos,
  setNumberOfVideos,
  maxClips,
  batchMode = false,
  conversionMode,
  setConversionMode,
  autoLength,
  setAutoLength,
  autoHookLength,
  setAutoHookLength,
}) => {
  // Filter out general prompt type (gaming re-enabled with Gemini-only video analysis)
  const availablePromptTypes = PROMPT_TYPES.filter(
    (type) => type !== "general"
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-text-primary">Clip Settings</h3>

      <Select
        label="Content Type"
        selectedKeys={[promptType]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as PromptType;
          if (key) setPromptType(key);
        }}
      >
        {availablePromptTypes.map((type) => (
          <SelectItem key={type}>{PROMPT_TYPE_LABELS[type]}</SelectItem>
        ))}
      </Select>

      <Select
        label="Crop Mode"
        selectedKeys={[conversionMode]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as ConversionMode;
          if (key) setConversionMode(key);
        }}
        description={
          CONVERSION_MODE_OPTIONS.find((o) => o.key === conversionMode)
            ?.description
        }
      >
        {CONVERSION_MODE_OPTIONS.map((mode) => (
          <SelectItem key={mode.key} startContent={<Icon icon={mode.icon} />}>
            {mode.label}
          </SelectItem>
        ))}
      </Select>

      <Textarea
        label="Custom Instructions (Optional)"
        placeholder={PROMPT_TYPE_PLACEHOLDERS[promptType]}
        value={customPrompt}
        onValueChange={setCustomPrompt}
        minRows={3}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            Total Length{!autoLength && ` — ${length}s`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Auto</span>
            <Switch
              size="sm"
              isSelected={autoLength}
              onValueChange={setAutoLength}
              color="primary"
            />
          </div>
        </div>
        {autoLength ? (
          <p className="text-xs text-text-tertiary italic">
            AI will choose the optimal clip length
          </p>
        ) : (
          <Slider
            size="sm"
            step={1}
            minValue={10}
            maxValue={120}
            value={length}
            onChange={(value) => setLength(value as number)}
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            Hook Length{!autoHookLength && ` — ${hookLength}s`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Auto</span>
            <Switch
              size="sm"
              isSelected={autoHookLength}
              onValueChange={setAutoHookLength}
              color="primary"
            />
          </div>
        </div>
        {autoHookLength ? (
          <p className="text-xs text-text-tertiary italic">
            AI will choose the optimal hook length
          </p>
        ) : (
          <Slider
            size="sm"
            step={1}
            minValue={2}
            maxValue={15}
            value={hookLength}
            onChange={(value) => setHookLength(value as number)}
          />
        )}
      </div>

      <Slider
        label="Number of Clips to Generate"
        size="sm"
        step={1}
        minValue={1}
        maxValue={maxClips !== undefined ? Math.min(maxClips, 10) : 10}
        value={numberOfVideos}
        onChange={(value) => setNumberOfVideos(value as number)}
        getValue={(value) => `${value} clip${value !== 1 ? "s" : ""}`}
        isDisabled={maxClips !== undefined && maxClips < 1}
      />
    </div>
  );
};
