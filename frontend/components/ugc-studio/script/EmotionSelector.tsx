"use client";

import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { EMOTIONS, EMOTION_CONFIG, type Emotion } from "./types";

interface EmotionSelectorProps {
  value: Emotion;
  onChange: (emotion: Emotion) => void;
  compact?: boolean;
}

export function EmotionSelector({ value, onChange, compact }: EmotionSelectorProps) {
  const config = EMOTION_CONFIG[value];

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="flat"
          size={compact ? "sm" : "md"}
          className={`${config.color} min-w-[100px]`}
        >
          <span className="mr-1">{config.emoji}</span>
          {config.label}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Select emotion"
        selectionMode="single"
        selectedKeys={[value]}
        onAction={(key) => onChange(key as Emotion)}
        className="bg-surface-elevated"
      >
        {EMOTIONS.map((emotion) => {
          const emotionConfig = EMOTION_CONFIG[emotion];
          return (
            <DropdownItem
              key={emotion}
              startContent={<span>{emotionConfig.emoji}</span>}
              className="text-text-primary"
            >
              {emotionConfig.label}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
}
