"use client";

import React from "react";
import { Select, SelectItem, Slider, Textarea } from "@heroui/react";
import {
  PromptType,
  PROMPT_TYPES,
  PROMPT_TYPE_LABELS,
  PROMPT_TYPE_PLACEHOLDERS,
} from "@/constants/promptTypes";

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
}) => {
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
        {PROMPT_TYPES.map((type) => (
          <SelectItem key={type}>{PROMPT_TYPE_LABELS[type]}</SelectItem>
        ))}
      </Select>

      <Textarea
        label={promptType === "gaming" ? "Describe the Clip" : "Custom Instructions (Optional)"}
        placeholder={PROMPT_TYPE_PLACEHOLDERS[promptType]}
        value={customPrompt}
        onValueChange={setCustomPrompt}
        minRows={3}
        description={promptType === "gaming" ? "Help the AI understand what game and moments to look for" : undefined}
      />

      <Slider
        label="Total Length (seconds)"
        size="sm"
        step={1}
        minValue={10}
        maxValue={120}
        value={length}
        onChange={(value) => setLength(value as number)}
        getValue={(value) => `${value}s`}
      />

      <Slider
        label="Hook Length (seconds)"
        size="sm"
        step={1}
        minValue={2}
        maxValue={15}
        value={hookLength}
        onChange={(value) => setHookLength(value as number)}
        getValue={(value) => `${value}s`}
      />

      <Slider
        label="Number of Clips to Generate"
        size="sm"
        step={1}
        minValue={1}
        maxValue={maxClips !== undefined ? Math.min(maxClips, 15) : 15}
        value={numberOfVideos}
        onChange={(value) => setNumberOfVideos(value as number)}
        getValue={(value) => `${value} clip${value !== 1 ? "s" : ""}`}
        isDisabled={maxClips !== undefined && maxClips < 1}
      />
    </div>
  );
};
