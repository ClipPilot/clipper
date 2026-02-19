"use client";

import {
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
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
  { key: "7days", label: "Last 7 Days" },
  { key: "30days", label: "Last 30 Days" },
  { key: "90days", label: "Last 90 Days" },
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
  dateRangeValue = "7days",
  onDateRangeChange,
  dateRangeOptions,
  countLabel,
  rightContent,
}: FilterBarProps) {
  const dateOptions = dateRangeOptions ?? DEFAULT_DATE_OPTIONS;
  const selectedPlatformLabel =
    PLATFORM_OPTIONS.find((o) => o.key === platformValue)?.label ?? "All Platforms";
  const selectedDateLabel =
    dateOptions.find((o) => o.key === dateRangeValue)?.label ?? "Last 7 Days";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-base flex-wrap">
      <Input
        size="sm"
        variant="flat"
        placeholder={searchPlaceholder}
        value={searchValue}
        onValueChange={onSearchChange}
        startContent={
          <Icon icon="solar:magnifer-linear" width={16} className="text-text-tertiary" />
        }
        classNames={{
          base: "max-w-[220px]",
          input: "bg-transparent text-sm",
          inputWrapper: "bg-surface-elevated border border-border-base h-9",
        }}
      />

      {showDateRange && (
        <Dropdown>
          <DropdownTrigger>
            <Button
              size="sm"
              variant="flat"
              className="bg-surface-elevated border border-border-base text-text-secondary h-9"
              startContent={<Icon icon="solar:calendar-linear" width={14} />}
              endContent={<Icon icon="solar:alt-arrow-down-linear" width={10} />}
            >
              {selectedDateLabel}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Date range"
            selectionMode="single"
            selectedKeys={new Set([dateRangeValue])}
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as string;
              if (key) onDateRangeChange?.(key);
            }}
          >
            {dateOptions.map((opt) => (
              <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      )}

      {showPlatformFilter && (
        <Dropdown>
          <DropdownTrigger>
            <Button
              size="sm"
              variant="flat"
              className="bg-surface-elevated border border-border-base text-text-secondary h-9"
              startContent={<Icon icon="solar:filter-linear" width={14} />}
              endContent={<Icon icon="solar:alt-arrow-down-linear" width={10} />}
            >
              {selectedPlatformLabel}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Platform filter"
            selectionMode="single"
            selectedKeys={new Set([platformValue])}
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as string;
              if (key) onPlatformChange?.(key);
            }}
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
            ))}
          </DropdownMenu>
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
