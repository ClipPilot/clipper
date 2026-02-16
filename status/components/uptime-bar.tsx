"use client";

import { DailyUptime } from "@/lib/types";

interface UptimeBarProps {
  history: DailyUptime[];
  uptimePercent: number | null;
}

function fillDays(history: DailyUptime[]): (DailyUptime | null)[] {
  const map = new Map(history.map((d) => [d.date, d]));
  const days: (DailyUptime | null)[] = [];
  const now = new Date();

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push(map.get(key) || null);
  }

  return days;
}

function barColor(day: DailyUptime | null): string {
  if (!day) return "#27272a";
  if (day.uptimePercent >= 99.5) return "#22c55e";
  if (day.uptimePercent >= 95) return "#f59e0b";
  return "#ef4444";
}

function tooltipText(day: DailyUptime | null, index: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (89 - index));
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!day) return `${label} · No data`;
  return `${label} · ${day.uptimePercent}% · ${day.avgResponseTime}ms avg`;
}

export default function UptimeBar({ history, uptimePercent }: UptimeBarProps) {
  const days = fillDays(history);
  const hasData = history.length > 0;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs tracking-wide uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          90-day uptime
        </span>
        {uptimePercent !== null && (
          <span
            className="text-xs font-semibold tabular-nums"
            style={{
              color:
                uptimePercent >= 99.9
                  ? "#22c55e"
                  : uptimePercent >= 99
                    ? "#f59e0b"
                    : "#ef4444",
            }}
          >
            {uptimePercent.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex gap-[2px] items-end h-8">
        {days.map((day, i) => (
          <div
            key={i}
            className="uptime-day flex-1 rounded-[1px] transition-all duration-150 hover:brightness-125 cursor-default"
            style={{
              backgroundColor: barColor(day),
              height: day ? "100%" : "40%",
              opacity: day ? (day.uptimePercent >= 99.5 ? 0.7 : 1) : 0.2,
              minWidth: "2px",
            }}
            data-tooltip={tooltipText(day, i)}
          />
        ))}
      </div>
      <div
        className="flex justify-between mt-1.5 text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span>90 days ago</span>
        <span>{hasData ? "Today" : "No historical data yet"}</span>
      </div>
    </div>
  );
}
