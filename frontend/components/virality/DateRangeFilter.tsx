"use client";

import { Button, DateRangePicker } from "@heroui/react";
import { today, getLocalTimeZone, parseDate } from "@internationalized/date";

export interface DateRangeValue {
  startDate?: string;
  endDate?: string;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const isAllTime = !value.startDate && !value.endDate;

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
      <Button
        size="sm"
        variant={isAllTime ? "solid" : "flat"}
        className={
          isAllTime
            ? "bg-accent-400 text-white"
            : "bg-surface-elevated text-text-secondary hover:text-text-primary"
        }
        onPress={() => onChange({})}
      >
        All Time
      </Button>
      <DateRangePicker
        size="sm"
        value={pickerValue as any}
        onChange={handlePickerChange as any}
        maxValue={today(getLocalTimeZone()) as any}
        className="max-w-xs"
        calendarProps={{
          classNames: {
            base: "bg-surface-base",
            headerWrapper: "bg-surface-elevated",
          },
        }}
      />
    </div>
  );
}
