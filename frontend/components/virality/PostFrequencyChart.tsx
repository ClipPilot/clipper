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
import type { ViralityPost } from "@/api/virality";
import { buildPostFrequencyDataFromRange } from "@/app/dashboard/virality/[competitorId]/utils";

const LINE_COLOR = "hsl(var(--heroui-primary))";

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
    <Card className="bg-surface-base border border-border-base">
      <section className="flex flex-col flex-nowrap">
        <div className="flex flex-col gap-y-2 p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <dt className="text-medium text-text-primary font-medium">
              Post Frequency
            </dt>
            {isHourly && (
              <span className="text-xs text-text-tertiary">Hourly</span>
            )}
          </div>
        </div>

        {hasData ? (
          <ResponsiveContainer
            className="min-h-[250px] [&_.recharts-surface]:outline-hidden"
            height="100%"
            width="100%"
          >
            <LineChart
              data={data}
              height={250}
              margin={{ left: 0, right: 16, top: 8, bottom: 0 }}
            >
              <CartesianGrid
                stroke="hsl(var(--heroui-default-200))"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                style={{ fontSize: "var(--heroui-font-size-tiny)" }}
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
                style={{ fontSize: "var(--heroui-font-size-tiny)" }}
              />
              <Tooltip
                content={({ label, payload }) => (
                  <div className="rounded-medium bg-foreground text-tiny shadow-small flex h-auto min-w-[120px] items-center gap-x-2 p-2.5">
                    <div className="flex w-full flex-col gap-y-1">
                      {payload?.map((p, index) => (
                        <div
                          key={index}
                          className="text-small text-background flex w-full items-center justify-between gap-x-2"
                        >
                          <span className="font-medium">
                            {p.value} {Number(p.value) === 1 ? "post" : "posts"}
                          </span>
                        </div>
                      ))}
                      <span className="text-small text-foreground-400 font-medium mt-0.5">
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
                  fill: "hsl(var(--heroui-background))",
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
