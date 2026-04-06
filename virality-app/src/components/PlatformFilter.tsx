"use client";

import { cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { platformIcon, platformIconColor } from "@clipper/shared-ui";

export type PlatformOption = "all" | "tiktok" | "instagram" | "x";

interface PlatformFilterProps {
  value: PlatformOption;
  onChange: (value: PlatformOption) => void;
}

const OPTIONS: { key: PlatformOption; label: string }[] = [
  { key: "all", label: "All Platforms" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "X" },
];

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            value === opt.key
              ? "bg-accent-400/10 text-accent-400 border border-accent-400/30"
              : "bg-surface-elevated text-text-tertiary hover:text-text-secondary border border-transparent"
          )}
        >
          {opt.key !== "all" && (
            <Icon
              icon={platformIcon(opt.key)}
              width={14}
              className={value === opt.key ? "text-accent-400" : platformIconColor(opt.key)}
            />
          )}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
