"use client";

import { useMemo } from "react";
import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ViralityPost } from "../lib/viralityTypes";
import { buildPostFrequencyDataFromRange } from "../lib/viralityUtils";

const LINE_COLOR = "var(--accent)";

interface PostFrequencyChartProps {
  posts: ViralityPost[];
  startDate?: string;
  endDate?: string;
}

export function PostFrequencyChart({ posts, startDate, endDate }: PostFrequencyChartProps) {
  const { data, isHourly } = useMemo(
    () => buildPostFrequencyDataFromRange(posts, startDate, endDate),
    [posts, startDate, endDate]
  );

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card className="bg-surface-base border border-border-base h-full">
      <section className="flex flex-col flex-nowrap h-full">
        <div className="flex flex-col gap-y-2 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <dt className="text-base text-text-primary font-medium">
              Post Frequency
            </dt>
            {isHourly && (
              <span className="text-xs text-text-tertiary">Hourly</span>
            )}
          </div>
        </div>

        {hasData ? (
          <ResponsiveContainer
            className="[&_.recharts-surface]:outline-hidden"
            height={250}
            width="100%"
          >
            <LineChart
              data={data}
              height={250}
              margin={{ left: 0, right: 16, top: 8, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--border-base)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                style={{ fontSize: "11px" }}
                tickLine={false}
                interval={
                  isHourly
                    ? 1
                    : data.length <= 7
                      ? 0
                      : Math.max(0, Math.floor(data.length / 7) - 1)
                }
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={32}
                style={{ fontSize: "11px" }}
              />
              <Tooltip
 content={({ label, payload }) => (
 <div className="rounded-md bg-surface-base border border-border-base text-xs shadow-xl flex h-auto min-w-[120px] items-center gap-x-2 p-2.5">
 <div className="flex w-full flex-col gap-y-1">
 {payload?.map((p, index) => (
 <div
 key={index}
 className="text-sm text-text-primary flex w-full items-center justify-between gap-x-2"
 >
 <span className="font-medium">
 {p.value} {Number(p.value) === 1 ? "post" : "posts"}
 </span>
 </div>
 ))}
 <span className="text-sm text-text-tertiary font-medium mt-0.5">
 {label}
 </span>
 </div>
 </div>
 )}
 cursor={{ strokeWidth: 0 }}
 />
              <Line
                type="monotone"
                dataKey="count"
                stroke={LINE_COLOR}
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  stroke: LINE_COLOR,
                  strokeWidth: 2,
                  fill: "var(--surface-base)",
                  r: 4,
                }}
                animationDuration={800}
                animationEasing="ease-in-out"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Icon
              icon="solar:chart-2-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-text-secondary text-sm">
              Post frequency data will appear after syncing
            </p>
          </div>
        )}
      </section>
    </Card>
  );
}
