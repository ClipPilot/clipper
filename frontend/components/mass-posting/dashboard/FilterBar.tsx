"use client";

import { Input,
  Dropdown,
  Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showPlatformFilter?: boolean;
  platformValue?: string;
  onPlatformChange?: (value: string) => void;
  showDateRange?: boolean;
  dateRangeValue?: string;
  onDateRangeChange?: (value: string) => void;
  dateRangeOptions?: { key: string; label: string }[];
  countLabel?: string;
  rightContent?: React.ReactNode;
}

const PLATFORM_OPTIONS = [
  { key: "all", label: "All Platforms" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "X (Twitter)" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
];

const DEFAULT_DATE_OPTIONS = [
  { key: "mtd", label: "Month to Date" },
  { key: "7days", label: "Last 7 Days" },
  { key: "30days", label: "Last 30 Days" },
  { key: "3months", label: "Last 3 Months" },
  { key: "1year", label: "Last Year" },
  { key: "all", label: "All Time" },
];

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search by title...",
  showPlatformFilter = true,
  platformValue = "all",
  onPlatformChange,
  showDateRange = true,
  dateRangeValue = "mtd",
  onDateRangeChange,
  dateRangeOptions,
  countLabel,
  rightContent,
}: FilterBarProps) {
  const dateOptions = dateRangeOptions ?? DEFAULT_DATE_OPTIONS;
  const selectedPlatformLabel =
    PLATFORM_OPTIONS.find((o) => o.key === platformValue)?.label ?? "All Platforms";
  const selectedDateLabel =
    dateOptions.find((o) => o.key === dateRangeValue)?.label ?? "Month to Date";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-base flex-wrap">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon icon="solar:magnifer-linear" width={16} className="text-text-tertiary" />
        </div>
        <Input
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          value={searchValue}
          className="pl-9"
        />
      </div>

      {showDateRange && (
        <Dropdown>
          <Button size="sm" variant="tertiary" className="bg-white/[0.04] text-text-secondary h-9">
            <Icon icon="solar:calendar-linear" width={14} />
            {selectedDateLabel}
            <Icon icon="solar:alt-arrow-down-linear" width={10} />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label="Date range"
              selectionMode="single"
              selectedKeys={new Set([dateRangeValue])}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as string;
                if (key) onDateRangeChange?.(key);
              }}
            >
              {dateOptions.map((opt) => (
                <Dropdown.Item key={opt.key}>{opt.label}</Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}

      {showPlatformFilter && (
        <Dropdown>
          <Button size="sm" variant="tertiary" className="bg-white/[0.04] text-text-secondary h-9">
            <Icon icon="solar:filter-linear" width={14} />
            {selectedPlatformLabel}
            <Icon icon="solar:alt-arrow-down-linear" width={10} />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label="Platform filter"
              selectionMode="single"
              selectedKeys={new Set([platformValue])}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as string;
                if (key) onPlatformChange?.(key);
              }}
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <Dropdown.Item key={opt.key}>{opt.label}</Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}

      <div className="flex-1" />

      {countLabel && (
        <span className="text-sm text-text-secondary font-medium">
          {countLabel}
        </span>
      )}

      {rightContent}
    </div>
  );
}
