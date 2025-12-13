"use client";

import React from "react";
import { Button, Input, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface TextOverlayPanelProps {
  customText: string;
  setCustomText: (value: string) => void;
  textPosition: "top" | "middle" | "bottom";
  setTextPosition: (value: "top" | "middle" | "bottom") => void;
  textColor: string;
  setTextColor: (value: string) => void;
}

const TEXT_POSITIONS = [
  { key: "top", label: "Top", icon: "solar:align-top-bold" },
  { key: "middle", label: "Middle", icon: "solar:align-vertical-center-bold" },
  { key: "bottom", label: "Bottom", icon: "solar:align-bottom-bold" },
];

const TEXT_COLORS = [
  { color: "#FFFFFF", name: "White" },
  { color: "#000000", name: "Black" },
  { color: "#FF0000", name: "Red" },
  { color: "#FF6B00", name: "Orange" },
  { color: "#FFD600", name: "Yellow" },
  { color: "#00FF00", name: "Lime" },
  { color: "#00D4AA", name: "Teal" },
  { color: "#0084FF", name: "Blue" },
  { color: "#7B2CBF", name: "Purple" },
  { color: "#FF006E", name: "Pink" },
  { color: "#8B4513", name: "Brown" },
  { color: "#808080", name: "Gray" },
  { color: "#FFE5E5", name: "Light Pink" },
  { color: "#E5F4FF", name: "Light Blue" },
  { color: "#FFFBE5", name: "Light Yellow" },
  { color: "#E5FFE5", name: "Light Green" },
];

export const TextOverlayPanel: React.FC<TextOverlayPanelProps> = ({
  customText,
  setCustomText,
  textPosition,
  setTextPosition,
  textColor,
  setTextColor,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-text-primary">
        Text Overlay (Optional)
      </h3>

      {/* Custom Text */}
      <Input
        label="Custom Text"
        placeholder="e.g., 🔥 MUST WATCH 🔥, NEW PRODUCT ALERT"
        value={customText}
        onValueChange={setCustomText}
      />

      {/* Text Position */}
      <div>
        <label className="text-sm font-medium text-text-primary mb-3 block">
          Text Position
        </label>
        <div className="grid grid-cols-3 gap-3">
          {TEXT_POSITIONS.map((pos) => (
            <Button
              key={pos.key}
              variant={textPosition === pos.key ? "solid" : "bordered"}
              color={textPosition === pos.key ? "primary" : "default"}
              onPress={() => setTextPosition(pos.key as any)}
              startContent={<Icon icon={pos.icon} />}
            >
              {pos.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label className="text-sm font-medium text-text-primary mb-3 block">
          Text Color
        </label>
        <div className="grid grid-cols-8 gap-2">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.color}
              onClick={() => setTextColor(c.color)}
              className={`h-8 w-8 rounded border-2 transition-all ${
                textColor === c.color
                  ? "border-accent-400 ring-2 ring-accent-400 ring-offset-2 ring-offset-surface-base scale-110"
                  : "border-border-base hover:scale-105"
              }`}
              style={{ backgroundColor: c.color }}
              title={c.name}
            />
          ))}
        </div>
      </div>

    </div>
  );
};

