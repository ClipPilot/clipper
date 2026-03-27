"use client";

import { Dropdown, Button } from "@heroui/react";
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
<Button
 variant="tertiary"
 size={compact ? "sm" : "md"}
 className={`${config.color} min-w-[100px]`}
 >
          <span className="mr-1">{config.emoji}</span>
          {config.label}
        </Button>
<Dropdown.Popover>

<Dropdown.Menu
        aria-label="Select emotion"
        selectionMode="single"
        selectedKeys={[value]}
        onAction={(key) => onChange(key as Emotion)}
        className="bg-surface-elevated"
      >
        {EMOTIONS.map((emotion) => {
          const emotionConfig = EMOTION_CONFIG[emotion];
          return (
            <Dropdown.Item
              key={emotion}
              className="text-text-primary"
            >
              <span>{emotionConfig.emoji}</span>
              {emotionConfig.label}
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
</Dropdown.Popover>
    </Dropdown>
  );
}
