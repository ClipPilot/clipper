"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Platform } from "./AccountsTable";

type FilterOption = Platform | "all";

interface PlatformFilterProps {
  selected: FilterOption;
  onChange: (platform: FilterOption) => void;
}

const filters: { value: FilterOption; label: string; icon?: string }[] = [
  { value: "all", label: "All Platforms" },
  { value: "tiktok", label: "TikTok", icon: "ri:tiktok-fill" },
  { value: "instagram", label: "Instagram", icon: "ri:instagram-fill" },
  { value: "x", label: "X", icon: "ri:twitter-x-fill" },
];

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <Button
 key={filter.value}
 size="sm"
 variant={selected === filter.value ? "primary" : "ghost"}
 className={
 selected === filter.value
 ? "bg-accent-400 text-white"
 : "bg-surface-elevated text-text-secondary hover:text-text-primary"
 }
 onPress={() => onChange(filter.value)}
 >
          {filter.icon ? <Icon icon={filter.icon} width={16} /> : undefined}
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
