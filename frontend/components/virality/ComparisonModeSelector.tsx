"use client";

import { useState } from "react";
import { Dropdown,
  Button,
  Popover,
  Calendar } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  today,
  getLocalTimeZone,
  type DateValue,
} from "@internationalized/date";

export type ComparisonMode =
  | { type: "last-sync" }
  | { type: "days-ago"; days: number }
  | { type: "custom-date"; date: Date };

interface ComparisonModeSelectorProps {
  selected: ComparisonMode;
  onChange: (mode: ComparisonMode) => void;
}

export function getModeLabel(mode: ComparisonMode): string {
  switch (mode.type) {
    case "last-sync":
      return "Since last sync";
    case "days-ago":
      return `Since ${mode.days} days ago`;
    case "custom-date":
      return `Since ${mode.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
}

export function ComparisonModeSelector({
  selected,
  onChange,
}: ComparisonModeSelectorProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const minDate = today(getLocalTimeZone()).subtract({ days: 28 });
  const maxDate = today(getLocalTimeZone());

  const handleCalendarChange = (value: DateValue) => {
    const d = new Date(value.year, value.month - 1, value.day);
    onChange({ type: "custom-date", date: d });
    setIsCalendarOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Dropdown>
        <Button
          size="sm"
          variant="tertiary"
          className="bg-surface-elevated text-text-secondary hover:text-text-primary"
        >
            <Icon icon="solar:chart-square-linear" width={16} />
            {getModeLabel(selected)}
            <Icon icon="solar:alt-arrow-down-linear" width={14} />
        </Button>
<Dropdown.Popover>

<Dropdown.Menu
          aria-label="Comparison mode"
          selectionMode="single"
          selectedKeys={new Set([
            selected.type === "last-sync"
              ? "last-sync"
              : selected.type === "days-ago"
                ? `${selected.days}d`
                : "custom",
          ])}
          onAction={(key) => {
            if (key === "last-sync") onChange({ type: "last-sync" });
            else if (key === "2d") onChange({ type: "days-ago", days: 2 });
            else if (key === "7d") onChange({ type: "days-ago", days: 7 });
            else if (key === "custom") setIsCalendarOpen(true);
          }}
        >
          <Dropdown.Item key="last-sync">Since last sync</Dropdown.Item>
          <Dropdown.Item key="2d">Since 2 days ago</Dropdown.Item>
          <Dropdown.Item key="7d">Since 7 days ago</Dropdown.Item>
          <Dropdown.Item key="custom">Custom date...</Dropdown.Item>
        </Dropdown.Menu>
</Dropdown.Popover>
      </Dropdown>

      <Popover
        isOpen={isCalendarOpen}
        onOpenChange={setIsCalendarOpen}
      >
        <Popover.Trigger>
          <span className="hidden" />
        </Popover.Trigger>
        <Popover.Content placement="bottom" className="p-0">
          <Calendar
            aria-label="Select comparison date"
            minValue={minDate as any}
            maxValue={maxDate as any}
            onChange={handleCalendarChange as any}
            className="bg-surface-base"
          />
        </Popover.Content>
      </Popover>
    </div>
  );
}
