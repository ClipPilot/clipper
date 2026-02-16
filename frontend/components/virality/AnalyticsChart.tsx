"use client";

import { useState, useMemo } from "react";
import {
  Card,
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
  YAxis,
} from "recharts";
import type { ViralityAccount, ViralityPost } from "@/api/virality";
import { formatChartValue } from "@/lib/formatters";
import { CHART_COLORS } from "@/lib/platformUtils";
import { buildChartDataByAccount } from "@/app/dashboard/virality/[competitorId]/utils";

type ChartMetricKey = "likes" | "comments" | "views";

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatHourKey(hourKey: string) {
  const d = new Date(hourKey + ":00:00Z");
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
  };
}

/** Custom XAxis tick: shows date on line 1, time on line 2. Only shows date when the day changes. */
function SyncTick({ x, y, payload, index, chartData }: any) {
  if (!payload?.value) return null;
  const hourKey = payload.value;
  const { date, time } = formatHourKey(hourKey);

  const prevHourKey = index > 0 ? chartData[index - 1]?.hourKey : null;
  const prevDate = prevHourKey ? formatHourKey(prevHourKey).date : null;
  const showDate = date !== prevDate;

  return (
    <g transform={`translate(${x},${y})`}>
      {showDate && (
        <text
          x={0} y={0} dy={12}
          textAnchor="middle"
          fontSize="var(--heroui-font-size-tiny)"
          fill="hsl(var(--heroui-default-500))"
        >
          {date}
        </text>
      )}
      <text
        x={0} y={0} dy={showDate ? 24 : 12}
        textAnchor="middle"
        fontSize="var(--heroui-font-size-tiny)"
        fill="hsl(var(--heroui-default-400))"
      >
        {time}
      </text>
    </g>
  );
}

interface AnalyticsChartProps {
  accounts: ViralityAccount[];
  postsByAccount: Record<number, ViralityPost[]>;
  /** All accounts (for stable axis domains across tab switches) */
  allAccounts?: ViralityAccount[];
  /** All accounts' posts (for stable axis domains across tab switches) */
  allPostsByAccount?: Record<number, ViralityPost[]>;
  /** Stable color map keyed by account ID. When provided, colors stay consistent across tab switches. */
  colorMap?: Record<number, string>;
  startDate?: string;
  endDate?: string;
}

export function AnalyticsChart({ accounts, postsByAccount, allAccounts, allPostsByAccount, colorMap, startDate, endDate }: AnalyticsChartProps) {
  const [activeMetric, setActiveMetric] = useState<ChartMetricKey>("views");

  const getColor = (account: ViralityAccount, index: number) =>
    colorMap?.[account.id] ?? CHART_COLORS[index % CHART_COLORS.length];

  // Build chart data from ALL accounts so X-axis (time points) stays stable
  const axisAccounts = allAccounts ?? accounts;
  const axisPostsByAccount = allPostsByAccount ?? postsByAccount;

  const fullChartData = useMemo(
    () =>
      buildChartDataByAccount(
        axisPostsByAccount,
        axisAccounts.map((a) => a.id),
        activeMetric,
        startDate,
        endDate,
      ),
    [axisPostsByAccount, axisAccounts, activeMetric, startDate, endDate]
  );

  // The visible chart data includes all time points but only active accounts' values
  const chartData = useMemo(() => {
    return fullChartData.map((point) => {
      const filtered: Record<string, string | number> = { hourKey: point.hourKey };
      for (const account of accounts) {
        filtered[`account_${account.id}`] = point[`account_${account.id}`] ?? 0;
      }
      return filtered;
    });
  }, [fullChartData, accounts]);

  // Y-axis domain from full data (all accounts aggregated per time point)
  const yDomain = useMemo(() => {
    let max = 0;
    for (const point of fullChartData) {
      let sum = 0;
      for (const key of Object.keys(point)) {
        if (key.startsWith("account_")) sum += (point[key] as number) || 0;
      }
      if (sum > max) max = sum;
    }
    return [0, max > 0 ? max : "auto"] as [number, number | "auto"];
  }, [fullChartData]);

  const hasData = fullChartData.length > 0;

  const totals = useMemo(() => {
    let likes = 0,
      comments = 0,
      views = 0;
    for (const account of accounts) {
      const posts = postsByAccount[account.id] || [];
      for (const post of posts) {
        likes += post.like_count || 0;
        comments += post.comment_count || 0;
        views += post.video_play_count || 0;
      }
    }
    return { likes, comments, views };
  }, [accounts, postsByAccount]);

  const metrics: {
    key: ChartMetricKey;
    title: string;
    value: number;
    tooltip?: string;
  }[] = [
    {
      key: "views",
      title: "Total Views",
      value: totals.views,
      tooltip: "Only counts views on video posts (Reels)",
    },
    { key: "likes", title: "Total Likes", value: totals.likes },
    { key: "comments", title: "Total Comments", value: totals.comments },
  ];

  return (
    <Card className="bg-surface-base border border-border-base h-full">
      <section className="flex flex-col flex-nowrap h-full">
        <div className="flex flex-col justify-between gap-y-2 p-6">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-medium text-text-primary font-medium inline-flex items-center gap-1.5">
                Analytics
                <HTooltip content={`Times shown in ${TIMEZONE}`} placement="top" size="sm">
                  <Icon
                    icon="solar:clock-circle-linear"
                    width={14}
                    className="text-default-400 cursor-help"
                  />
                </HTooltip>
              </dt>
              <div className="flex items-center gap-3 flex-wrap">
                {accounts.map((account, i) => (
                  <div key={account.id} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-[3px] rounded-full"
                      style={{
                        backgroundColor: getColor(account, i),
                      }}
                    />
                    <span className="text-xs text-text-tertiary">
                      @{account.username}
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer
              className="[&_.recharts-surface]:outline-hidden"
              height="100%"
              width="100%"
            >
              <AreaChart
                key={activeMetric}
                accessibilityLayer
                data={chartData}
                margin={{ left: 0, right: 0 }}
              >
                <defs>
                  {accounts.map((account, i) => {
                    const color = getColor(account, i);
                    return (
                      <linearGradient
                        key={account.id}
                        id={`gradient-${account.id}`}
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop offset="10%" stopColor={color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--heroui-default-200))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="hourKey"
                  tickLine={false}
                  tick={(props: any) => <SyncTick {...props} chartData={chartData} />}
                  interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                  height={40}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={yDomain}
                  width={50}
                  style={{ fontSize: "var(--heroui-font-size-tiny)" }}
                  tickFormatter={formatChartValue}
                />
                <Tooltip
                  content={({ payload }) => {
                    const hourKey = payload?.[0]?.payload?.hourKey;
                    const label = hourKey ? formatHourKey(hourKey) : null;
                    return (
                    <div className="rounded-medium bg-foreground text-tiny shadow-small min-w-[160px] p-2.5">
                      <div className="flex w-full flex-col gap-y-1">
                        {payload?.map((p, index) => {
                          const account = accounts.find(
                            (a) => `account_${a.id}` === p.dataKey
                          );
                          return (
                            <div
                              key={index}
                              className="text-small text-background flex w-full items-center justify-between gap-x-2"
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span className="text-foreground-400">
                                  @{account?.username || "Unknown"}
                                </span>
                              </div>
                              <span className="font-medium">
                                {formatChartValue(p.value as number)}
                              </span>
                            </div>
                          );
                        })}
                        {label && (
                          <span className="text-small text-foreground-400 font-medium mt-0.5">
                            {label.date} {label.time}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                  }}
                  cursor={{ strokeWidth: 0 }}
                />
                {accounts.map((account, i) => {
                  const color = getColor(account, i);
                  return (
                    <Area
                      key={account.id}
                      activeDot={{
                        stroke: color,
                        strokeWidth: 2,
                        fill: "hsl(var(--heroui-background))",
                        r: 4,
                      }}
                      animationDuration={800}
                      animationEasing="ease-in-out"
                      dataKey={`account_${account.id}`}
                      fill={`url(#gradient-${account.id})`}
                      stroke={color}
                      strokeWidth={2.5}
                      type="monotone"
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Icon
              icon="solar:chart-2-linear"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-text-secondary text-sm">
              Sync data not available for this date range.
            </p>
          </div>
        )}
      </section>
    </Card>
  );
}
