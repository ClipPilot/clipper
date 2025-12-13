"use client";

import React from "react";
import { Select, SelectItem, Slider, Textarea } from "@heroui/react";

interface SettingsPanelProps {
  promptType: "business" | "viral";
  setPromptType: (value: "business" | "viral") => void;
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  length: number;
  setLength: (value: number) => void;
  hookLength: number;
  setHookLength: (value: number) => void;
  numberOfVideos: number;
  setNumberOfVideos: (value: number) => void;
}

const PROMPT_TYPES = [
  { key: "business", label: "Business/Product Demo" },
  { key: "viral", label: "Viral/Entertainment" },
];

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
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-text-primary">
        Clip Settings
      </h3>

      {/* Prompt Type */}
      <Select
        label="Content Type"
        selectedKeys={[promptType]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0] as "business" | "viral";
          if (key) setPromptType(key);
        }}
      >
        {PROMPT_TYPES.map((type) => (
          <SelectItem key={type.key}>{type.label}</SelectItem>
        ))}
      </Select>

      {/* Custom Prompt */}
      <Textarea
        label="Custom Instructions (Optional)"
        placeholder="e.g., Focus on the product features, highlight funny moments..."
        value={customPrompt}
        onValueChange={setCustomPrompt}
        minRows={3}
      />

      {/* Length Slider */}
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

      {/* Hook Length Slider */}
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

      {/* Number of Videos */}
      <Slider
        label="Number of Clips to Generate"
        size="sm"
        step={1}
        minValue={1}
        maxValue={5}
        value={numberOfVideos}
        onChange={(value) => setNumberOfVideos(value as number)}
        getValue={(value) => `${value} clip${value !== 1 ? 's' : ''}`}
      />
    </div>
  );
};

