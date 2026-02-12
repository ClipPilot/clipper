"use client";

import { useState, useMemo } from "react";
import {
  Card,
  Tabs,
  Tab,
  Spacer,
  Tooltip as HTooltip,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ViralityPost } from "@/api/virality";
import { formatChartValue } from "@/lib/formatters";
import { buildChartData } from "@/app/dashboard/virality/[competitorId]/utils";

const CHART_LINE_COLOR = "hsl(var(--heroui-primary))";

type ChartMetricKey = "likes" | "comments" | "views";

interface AnalyticsChartProps {
  posts: ViralityPost[];
}

export function AnalyticsChart({ posts }: AnalyticsChartProps) {
  const [weekFilter, setWeekFilter] = useState(4);
  const [activeMetric, setActiveMetric] = useState<ChartMetricKey>("views");

  const chartData = useMemo(
    () => buildChartData(posts, weekFilter),
    [posts, weekFilter]
  );

  const hasData = chartData.length > 0;

  const totals = useMemo(() => {
    const likes = chartData.reduce((s, d) => s + d.likes, 0);
    const comments = chartData.reduce((s, d) => s + d.comments, 0);
    const views = chartData.reduce((s, d) => s + d.views, 0);
    return { likes, comments, views };
  }, [chartData]);

  const metrics: {
    key: ChartMetricKey;
    title: string;
    value: number;
    tooltip?: string;
  }[] = [
    { key: "views", title: "Total Views", value: totals.views, tooltip: "Only counts views on video posts (Reels)" },
    { key: "likes", title: "Total Likes", value: totals.likes },
    { key: "comments", title: "Total Comments", value: totals.comments },
  ];

  const series = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      value: d[activeMetric],
    }));
  }, [chartData, activeMetric]);

  return (
    <Card className="bg-surface-base border border-border-base">
      <section className="flex flex-col flex-nowrap">
        <div className="flex flex-col justify-between gap-y-2 p-6">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-medium text-text-primary font-medium">
                Analytics
              </dt>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-[3px] rounded-full"
                  style={{ backgroundColor: CHART_LINE_COLOR }}
                />
                <span className="text-xs text-text-tertiary">Aggregated</span>
              </div>
            </div>
            <Spacer y={2} />
            <Tabs
              size="sm"
              selectedKey={String(weekFilter)}
              onSelectionChange={(key) => setWeekFilter(Number(key))}
            >
              <Tab key="1" title="1 Week" />
              <Tab key="2" title="2 Weeks" />
              <Tab key="3" title="3 Weeks" />
              <Tab key="4" title="4 Weeks" />
            </Tabs>
            <div className="mt-2 flex w-full items-center">
              <div className="-my-3 flex w-full items-center gap-x-3 overflow-x-auto py-3">
                {metrics.map(({ key, title, value, tooltip }) => (
                  <button
                    key={key}
                    className={cn(
                      "rounded-medium flex w-full flex-col gap-2 p-3 transition-colors",
                      { "bg-default-100": activeMetric === key }
                    )}
                    onClick={() => setActiveMetric(key)}
                  >
                    <span
                      className={cn(
                        "text-small text-default-500 font-medium transition-colors inline-flex items-center gap-1",
                        { "text-primary": activeMetric === key }
                      )}
                    >
                      {title}
                      {tooltip && (
                        <HTooltip content={tooltip} placement="top" size="sm">
                          <Icon
                            icon="solar:info-circle-linear"
                            width={14}
                            className="text-default-400 cursor-help"
                          />
                        </HTooltip>
                      )}
                    </span>
                    <div className="flex items-center gap-x-3">
                      <span className="text-foreground text-3xl font-bold">
                        {formatChartValue(value)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hasData ? (
          <ResponsiveContainer
            className="min-h-[300px] [&_.recharts-surface]:outline-hidden"
            height="100%"
            width="100%"
          >
            <AreaChart
              key={`${weekFilter}-${activeMetric}`}
              accessibilityLayer
              data={series}
              height={300}
              margin={{ left: 0, right: 0 }}
              width={500}
            >
              <defs>
                <linearGradient id="gradient-main" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="10%"
                    stopColor={CHART_LINE_COLOR}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_LINE_COLOR}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
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
                interval={weekFilter <= 1 ? 0 : weekFilter <= 2 ? 1 : Math.max(0, Math.floor(series.length / 7) - 1)}
              />
              <Tooltip
                content={({ label, payload }) => (
                  <div className="rounded-medium bg-foreground text-tiny shadow-small flex h-auto min-w-[140px] items-center gap-x-2 p-2.5">
                    <div className="flex w-full flex-col gap-y-1">
                      {payload?.map((p, index) => (
                        <div
                          key={index}
                          className="text-small text-background flex w-full items-center justify-between gap-x-2"
                        >
                          <span className="font-medium">
                            {formatChartValue(p.value as number)}
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
              <Area
                activeDot={{
                  stroke: CHART_LINE_COLOR,
                  strokeWidth: 2,
                  fill: "hsl(var(--heroui-background))",
                  r: 4,
                }}
                animationDuration={800}
                animationEasing="ease-in-out"
                dataKey="value"
                fill="url(#gradient-main)"
                stroke={CHART_LINE_COLOR}
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Icon
              icon="solar:chart-2-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-text-secondary text-sm">
              Metrics will appear after the next sync
            </p>
          </div>
        )}
      </section>
    </Card>
  );
}
