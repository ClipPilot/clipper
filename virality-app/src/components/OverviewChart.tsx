"use client";

import { useState } from "react";
import { cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatChartValue } from "@clipper/shared-ui";

type MetricKey = "views" | "likes" | "comments";

interface ChartDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
}

interface OverviewChartProps {
  data: ChartDataPoint[];
  totals: { views: number; likes: number; comments: number };
  changes: { views: number | null; likes: number | null; comments: number | null };
}

const METRIC_COLOR: Record<MetricKey, string> = {
  views: "#8b5cf6",
  likes: "#ef4444",
  comments: "#3b82f6",
};

export type { ChartDataPoint };

export function OverviewChart({ data, totals, changes }: OverviewChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("views");

  const metrics: { key: MetricKey; title: string; value: number; change: number | null }[] = [
    { key: "views", title: "Total Views", value: totals.views, change: changes.views },
    { key: "likes", title: "Total Likes", value: totals.likes, change: changes.likes },
    { key: "comments", title: "Total Comments", value: totals.comments, change: changes.comments },
  ];

  const color = METRIC_COLOR[activeMetric];
  const hasData = data.length > 0;

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base text-text-primary font-medium">Analytics</h3>
        </div>

        <div className="flex items-center gap-3 mb-4 overflow-x-auto">
          {metrics.map(({ key, title, value, change }) => (
            <div
              key={key}
              className={cn(
                "rounded-lg flex flex-col gap-2 p-3 transition-all cursor-pointer border min-w-[150px] flex-1",
                activeMetric === key
                  ? "bg-accent-400/10 border-accent-400/30"
                  : "bg-transparent border-transparent hover:bg-surface-hover"
              )}
              onClick={() => setActiveMetric(key)}
            >
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  activeMetric === key ? "text-accent-400" : "text-text-tertiary"
                )}
              >
                {title}
              </span>
              <div className="flex items-center gap-x-3">
                <span className="text-text-primary text-2xl font-bold">
                  {formatChartValue(value)}
                </span>
                {change !== null && (
                  <span
                    className={cn(
                      "text-xs font-medium inline-flex items-center gap-0.5",
                      change >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    <Icon
                      icon={change >= 0 ? "solar:arrow-up-linear" : "solar:arrow-down-linear"}
                      width={12}
                    />
                    {Math.abs(change).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="px-2 pb-4">
          <ResponsiveContainer
            className="[&_.recharts-surface]:outline-hidden"
            height={300}
            width="100%"
          >
            <AreaChart data={data} margin={{ left: 0, right: 16 }}>
              <defs>
                <linearGradient id={`gradient-${activeMetric}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="10%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-base)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="date"
                tickLine={false}
                style={{ fontSize: "11px" }}
                tick={{ fill: "var(--text-tertiary)" }}
                interval={Math.max(0, Math.floor(data.length / 7) - 1)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={50}
                style={{ fontSize: "11px" }}
                tickFormatter={formatChartValue}
                tick={{ fill: "var(--text-tertiary)" }}
              />
              <Tooltip
                content={({ label, payload }) => {
                  if (!payload?.length) return null;
                  return (
                    <div className="rounded-xl bg-surface-base border border-border-base shadow-xl min-w-[180px] overflow-hidden">
                      <div className="px-3 py-2 border-b border-border-base">
                        <span className="text-xs text-text-tertiary font-medium">{label}</span>
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-y-1.5">
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-x-4">
                            <span className="text-xs text-text-tertiary capitalize">{String(p.dataKey)}</span>
                            <span className="text-sm text-text-primary font-semibold">
                              {formatChartValue(p.value as number)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
                cursor={{ stroke: "var(--border-light)", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Area
                animationDuration={800}
                animationEasing="ease-in-out"
                dataKey={activeMetric}
                fill={`url(#gradient-${activeMetric})`}
                stroke={color}
                strokeWidth={2.5}
                type="monotone"
                activeDot={{
                  stroke: color,
                  strokeWidth: 2,
                  fill: "var(--surface-base)",
                  r: 4,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-2 px-5">
          <Icon icon="solar:chart-2-linear" width={40} className="text-text-tertiary" />
          <p className="text-text-secondary text-sm">Chart data will appear after syncing accounts.</p>
        </div>
      )}
    </div>
  );
}
