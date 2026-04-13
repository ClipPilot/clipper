"use client";

import { useState } from "react";
import { Button, Dropdown, DateField, DateRangePicker, RangeCalendar } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { CalendarDate } from "@internationalized/date";
import { today, getLocalTimeZone, parseDate, startOfMonth, toZoned, toCalendarDateTime } from "@internationalized/date";

function localStartOfDay(date: CalendarDate): string {
  const zoned = toZoned(toCalendarDateTime(date, { hour: 0, minute: 0, second: 0, millisecond: 0 } as any), getLocalTimeZone());
  return new Date(zoned.toAbsoluteString()).toISOString();
}

function localEndOfDay(date: CalendarDate): string {
  const zoned = toZoned(toCalendarDateTime(date, { hour: 23, minute: 59, second: 59, millisecond: 999 } as any), getLocalTimeZone());
  return new Date(zoned.toAbsoluteString()).toISOString();
}

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
    startDate: localStartOfDay(monthStart),
    endDate: localEndOfDay(now),
  };
}

function subtractMonths(months: number): DateRangeValue {
  const tz = getLocalTimeZone();
  const now = today(tz);
  const start = now.subtract({ months });
  return {
    startDate: localStartOfDay(start),
    endDate: localEndOfDay(now),
  };
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [customAmount, setCustomAmount] = useState("3");
  const [customUnit, setCustomUnit] = useState<"months" | "years">("months");

  const pickerValue =
    value.startDate && value.endDate
      ? {
          start: parseDate(value.startDate.slice(0, 10)) as CalendarDate,
          end: parseDate(value.endDate.slice(0, 10)) as CalendarDate,
        }
      : null;

  const handlePickerChange = (range: { start: CalendarDate; end: CalendarDate } | null) => {
    if (!range) return;
    onChange({
      startDate: localStartOfDay(range.start),
      endDate: localEndOfDay(range.end),
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Dropdown>
        <Button
          size="sm"
          variant="tertiary"
          className="bg-surface-elevated text-text-secondary hover:text-text-primary"
        >
          Custom
          <Icon icon="solar:alt-arrow-down-linear" width={14} />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label="Date presets"
            selectionMode="single"
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as string | undefined;
              if (!key || key === "custom-apply") return;
              const months = parseInt(key, 10);
              if (months) onChange(subtractMonths(months));
            }}
          >
            {CUSTOM_PRESETS.map((preset) => (
              <Dropdown.Item id={preset.months.toString()} key={preset.months.toString()}>
                {preset.label}
              </Dropdown.Item>
            ))}
            <Dropdown.Item id="custom-apply" key="custom-apply" textValue="Custom range">
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                <Button
                  size="sm"
                  isIconOnly
                  className="bg-accent-400 text-white ml-auto"
                  onPress={() => {
                    const n = parseInt(customAmount, 10);
                    if (!n || n < 1) return;
                    const totalMonths = customUnit === "years" ? n * 12 : n;
                    onChange(subtractMonths(totalMonths));
                  }}
                >
                  <Icon icon="solar:arrow-right-linear" width={14} />
                </Button>
              </div>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <DateRangePicker
        value={pickerValue as any}
        onChange={handlePickerChange as any}
        maxValue={today(getLocalTimeZone()) as any}
        className="max-w-xs"
      >
        <DateField.Group fullWidth>
          <DateField.Input slot="start">
            {(segment: any) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateRangePicker.RangeSeparator />
          <DateField.Input slot="end">
            {(segment: any) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DateRangePicker.Trigger>
              <DateRangePicker.TriggerIndicator />
            </DateRangePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DateRangePicker.Popover>
          <RangeCalendar aria-label="Select date range">
            <RangeCalendar.Header>
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>
                {(day: string) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
              </RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>
                {(date: any) => <RangeCalendar.Cell date={date} />}
              </RangeCalendar.GridBody>
            </RangeCalendar.Grid>
          </RangeCalendar>
        </DateRangePicker.Popover>
      </DateRangePicker>
    </div>
  );
}
