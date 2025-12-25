"use client";

import React from "react";
import { Select, SelectItem, Slider, Textarea, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
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
  batchMode?: boolean;
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
}) => {
  // Filter out gaming in batch mode
  const availablePromptTypes = batchMode
    ? PROMPT_TYPES.filter((type) => type !== "gaming")
    : PROMPT_TYPES;

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

      {(promptType === "viral" || promptType === "business") && (
        <Card className="bg-primary-500/10 border border-primary-500/30">
          <CardBody className="p-3 flex flex-row items-start gap-3">
            <Icon icon="solar:info-circle-bold" className="text-primary-400 text-lg flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-300">
              This mode works best with videos that contain speech or dialogue. The AI uses spoken content to identify the most engaging moments.
            </p>
          </CardBody>
        </Card>
      )}

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
        maxValue={maxClips !== undefined ? Math.min(maxClips, 10) : 10}
        value={numberOfVideos}
        onChange={(value) => setNumberOfVideos(value as number)}
        getValue={(value) => `${value} clip${value !== 1 ? "s" : ""}`}
        isDisabled={maxClips !== undefined && maxClips < 1}
      />
    </div>
  );
};
