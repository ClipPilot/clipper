"use client";

import { useState, useRef, useEffect } from "react";
import { Button, DateRangePicker } from "@heroui/react";
import { Icon } from "@iconify/react";
import { today, getLocalTimeZone, parseDate, startOfMonth } from "@internationalized/date";

export interface DateRangeValue {
  startDate?: string;
  endDate?: string;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

const CUSTOM_PRESETS = [
  { label: "2 Months", months: 2 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
] as const;

/** Returns month-to-date range (1st of current month → today) */
export function getMonthToDateRange(): DateRangeValue {
  const tz = getLocalTimeZone();
  const now = today(tz);
  const monthStart = startOfMonth(now);
  return {
    startDate: monthStart.toString() + "T00:00:00.000Z",
    endDate: now.toString() + "T23:59:59.999Z",
  };
}

function subtractMonths(months: number): DateRangeValue {
  const tz = getLocalTimeZone();
  const now = today(tz);
  const start = now.subtract({ months });
  return {
    startDate: start.toString() + "T00:00:00.000Z",
    endDate: now.toString() + "T23:59:59.999Z",
  };
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("3");
  const [customUnit, setCustomUnit] = useState<"months" | "years">("months");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const pickerValue =
    value.startDate && value.endDate
      ? {
          start: parseDate(value.startDate.slice(0, 10)),
          end: parseDate(value.endDate.slice(0, 10)),
        }
      : null;

  const handlePickerChange = (range: { start: { toString(): string }; end: { toString(): string } } | null) => {
    if (!range) return;
    onChange({
      startDate: range.start.toString() + "T00:00:00.000Z",
      endDate: range.end.toString() + "T23:59:59.999Z",
    });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Custom preset dropdown */}
      <div className="relative" ref={dropdownRef}>
        <Button
 size="sm"
 variant="tertiary"
 className="bg-surface-elevated text-text-secondary hover:text-text-primary"
 onPress={() => setDropdownOpen((v) => !v)}
 >
          Custom
          <Icon icon="solar:alt-arrow-down-linear" width={14} />
</Button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white/[0.04] rounded-lg shadow-lg py-1 min-w-[140px]">
            {CUSTOM_PRESETS.map((preset) => (
              <div
                key={preset.months}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-base hover:text-text-primary transition-colors cursor-pointer"
                onClick={() => {
                  onChange(subtractMonths(preset.months));
                  setDropdownOpen(false);
                }}
              >
                {preset.label}
              </div>
            ))}
            <div className="border-t border-border-base mx-2 my-1" />
            <div className="flex items-center gap-1.5 px-3 py-2">
              <input
                type="number"
                min={1}
                max={99}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-12 rounded-md bg-surface-base border border-border-base text-text-primary text-sm text-center px-1 py-1 outline-none focus:border-accent-400"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as "months" | "years")}
                className="rounded-md bg-surface-base border border-border-base text-text-primary text-sm px-1.5 py-1 outline-none focus:border-accent-400"
              >
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
              <div
                className="ml-auto p-1 rounded-md bg-accent-400 text-white hover:bg-accent-500 transition-colors cursor-pointer"
                onClick={() => {
                  const n = parseInt(customAmount, 10);
                  if (!n || n < 1) return;
                  const totalMonths = customUnit === "years" ? n * 12 : n;
                  onChange(subtractMonths(totalMonths));
                  setDropdownOpen(false);
                }}
              >
                <Icon icon="solar:arrow-right-linear" width={14} />
              </div>
            </div>
          </div>
        )}
      </div>

      <DateRangePicker
        value={pickerValue as any}
        onChange={handlePickerChange as any}
        maxValue={today(getLocalTimeZone()) as any}
        className="max-w-xs text-sm"
      />
    </div>
  );
}
