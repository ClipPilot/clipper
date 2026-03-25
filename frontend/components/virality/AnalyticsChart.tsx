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
const TOTAL_COLOR = "#8b5cf6";

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
  /** Overlay accounts to show as individual lines alongside the total */
  accounts: ViralityAccount[];
  postsByAccount: Record<number, ViralityPost[]>;
  /** All accounts (used for total line and stable axis domains) */
  allAccounts?: ViralityAccount[];
  /** All accounts' posts (used for total line and stable axis domains) */
  allPostsByAccount?: Record<number, ViralityPost[]>;
  /** Stable color map keyed by account ID. When provided, colors stay consistent across tab switches. */
  colorMap?: Record<number, string>;
  startDate?: string;
  endDate?: string;
  /** Optional change % overrides for the metric cards (views, likes, comments). When provided, these are used instead of the internally computed daily change. */
  changeOverrides?: { views?: number | null; likes?: number | null; comments?: number | null };
}

export function AnalyticsChart({ accounts, postsByAccount, allAccounts, allPostsByAccount, colorMap, startDate, endDate, changeOverrides }: AnalyticsChartProps) {
  const [activeMetric, setActiveMetric] = useState<ChartMetricKey>("views");

  const getColor = (account: ViralityAccount, index: number) =>
    colorMap?.[account.id] ?? CHART_COLORS[index % CHART_COLORS.length];

  // Build chart data from ALL accounts so X-axis stays stable and we can compute total
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

  // Chart data: aggregated total line + individual overlay account lines
  const chartData = useMemo(() => {
    return fullChartData.map((point) => {
      let total = 0;
      for (const key of Object.keys(point)) {
        if (key.startsWith("account_")) total += (point[key] as number) || 0;
      }
      const merged: Record<string, string | number> = { hourKey: point.hourKey, total };
      for (const account of accounts) {
        merged[`account_${account.id}`] = point[`account_${account.id}`] ?? 0;
      }
      return merged;
    });
  }, [fullChartData, accounts]);

  const showTotal = accounts.length === 0;

  // Y-axis domain: from total when showing all, from overlay accounts when filtered
  const yDomain = useMemo(() => {
    let max = 0;
    for (const point of chartData) {
      if (showTotal) {
        const total = (point.total as number) || 0;
        if (total > max) max = total;
      } else {
        for (const account of accounts) {
          const val = (point[`account_${account.id}`] as number) || 0;
          if (val > max) max = val;
        }
      }
    }
    return [0, max > 0 ? max : "auto"] as [number, number | "auto"];
  }, [chartData, showTotal, accounts]);

  const hasData = fullChartData.length > 0;

  // When accounts are selected, use those for totals/tooltip; otherwise use all accounts
  const hasSelection = accounts.length > 0;
  const totalsAccounts = hasSelection ? accounts : axisAccounts;
  const totalsPostsByAccount = hasSelection ? postsByAccount : axisPostsByAccount;

  // Tooltip summary: all 3 metrics per hour so tooltip can show views/likes/comments regardless of active metric
  const tooltipByHour = useMemo(() => {
    const map: Record<string, { views: number; likes: number; comments: number }> = {};
    const startStr = startDate ? new Date(startDate).toISOString().slice(0, 13) : undefined;
    const endStr = endDate ? new Date(endDate).toISOString().slice(0, 13) : undefined;

    for (const account of totalsAccounts) {
      const posts = totalsPostsByAccount[account.id] || [];
      for (const post of posts) {
        if (!post.metrics_history?.length) continue;
        const postHourMax = new Map<string, { views: number; likes: number; comments: number }>();
        for (const entry of post.metrics_history) {
          const hour = entry.recorded_at.slice(0, 13);
          const views = entry.views ?? 0;
          const existing = postHourMax.get(hour);
          if (!existing || views > existing.views) {
            postHourMax.set(hour, { views, likes: entry.likes, comments: entry.comments });
          }
        }
        const sortedHours = Array.from(postHourMax.keys()).sort();
        let prev = { views: 0, likes: 0, comments: 0 };
        for (const hour of sortedHours) {
          const vals = postHourMax.get(hour)!;
          const delta = {
            views: Math.max(vals.views - prev.views, 0),
            likes: Math.max(vals.likes - prev.likes, 0),
            comments: Math.max(vals.comments - prev.comments, 0),
          };
          prev = vals;
          if (startStr && hour < startStr) continue;
          if (endStr && hour > endStr) continue;
          if (!map[hour]) map[hour] = { views: 0, likes: 0, comments: 0 };
          map[hour].views += delta.views;
          map[hour].likes += delta.likes;
          map[hour].comments += delta.comments;
        }
      }
    }
    return map;
  }, [totalsAccounts, totalsPostsByAccount, startDate, endDate]);

  // Metric card totals — filtered to selected accounts when applicable
  const totals = useMemo(() => {
    let likes = 0,
      comments = 0,
      views = 0;
    for (const account of totalsAccounts) {
      const posts = totalsPostsByAccount[account.id] || [];
      for (const post of posts) {
        likes += post.like_count || 0;
        comments += post.comment_count || 0;
        views += post.video_play_count || 0;
      }
    }
    return { likes, comments, views };
  }, [totalsAccounts, totalsPostsByAccount]);

  const dailyChange = useMemo(() => {
    const dayTotals = new Map<string, { views: number; likes: number; comments: number }>();
    for (const [hour, vals] of Object.entries(tooltipByHour)) {
      const day = hour.slice(0, 10);
      const existing = dayTotals.get(day) || { views: 0, likes: 0, comments: 0 };
      existing.views += vals.views;
      existing.likes += vals.likes;
      existing.comments += vals.comments;
      dayTotals.set(day, existing);
    }
    const days = Array.from(dayTotals.keys()).sort();
    if (days.length < 2) return { views: null, likes: null, comments: null };
    const today = dayTotals.get(days[days.length - 1])!;
    const yesterday = dayTotals.get(days[days.length - 2])!;
    const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;
    return {
      views: pct(today.views, yesterday.views),
      likes: pct(today.likes, yesterday.likes),
      comments: pct(today.comments, yesterday.comments),
    };
  }, [tooltipByHour]);

  // Precompute % change between consecutive hours for tooltip
  const tooltipChangeByHour = useMemo(() => {
    const sorted = Object.keys(tooltipByHour).sort();
    const changeMap: Record<string, { views: number | null; likes: number | null; comments: number | null }> = {};
    const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : null;
    for (let i = 0; i < sorted.length; i++) {
      const hour = sorted[i];
      if (i === 0) {
        changeMap[hour] = { views: null, likes: null, comments: null };
      } else {
        const prev = tooltipByHour[sorted[i - 1]];
        const cur = tooltipByHour[hour];
        changeMap[hour] = {
          views: pct(cur.views, prev.views),
          likes: pct(cur.likes, prev.likes),
          comments: pct(cur.comments, prev.comments),
        };
      }
    }
    return changeMap;
  }, [tooltipByHour]);

  const metrics: {
    key: ChartMetricKey;
    title: string;
    value: number;
    change: number | null;
    tooltip?: string;
  }[] = [
    {
      key: "views",
      title: "Total Views",
      value: totals.views,
      change: changeOverrides?.views !== undefined ? changeOverrides.views : dailyChange.views,
      tooltip: "Only counts views on video posts (Reels)",
    },
    { key: "likes", title: "Total Likes", value: totals.likes, change: changeOverrides?.likes !== undefined ? changeOverrides.likes : dailyChange.likes },
    { key: "comments", title: "Total Comments", value: totals.comments, change: changeOverrides?.comments !== undefined ? changeOverrides.comments : dailyChange.comments },
  ];

  return (
    <Card className="bg-surface-base border border-border-base h-full">
      <section className="flex flex-col flex-nowrap h-full">
        <div className="flex flex-col justify-between gap-y-2 p-3 sm:p-6">
          <div className="flex flex-col gap-y-2">
            <div className="flex items-center justify-between">
              <dt className="text-base text-text-accent font-medium inline-flex items-center gap-1.5">
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
                {accounts.length === 0 && (
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-[3px] rounded-full"
                      style={{ backgroundColor: TOTAL_COLOR }}
                    />
                    <span className="text-xs text-text-tertiary">All Accounts</span>
                  </div>
                )}
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
                {metrics.map(({ key, title, value, change, tooltip }) => (
                  <button
                    key={key}
                    className={cn(
                      "rounded-md flex w-full flex-col gap-2 p-3 transition-colors",
                      { "bg-default-100": activeMetric === key }
                    )}
                    onClick={() => setActiveMetric(key)}
                  >
                    <span
                      className={cn(
                        "text-sm text-default-500 font-medium transition-colors inline-flex items-center gap-1",
                        { "text-accent": activeMetric === key }
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
                      <span className="text-foreground text-xl sm:text-3xl font-bold">
                        {formatChartValue(value)}
                      </span>
                      {change !== null && (
                        <span className={cn(
                          "text-xs font-medium inline-flex items-center gap-0.5",
                          change >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          <Icon
                            icon={change >= 0 ? "solar:arrow-up-linear" : "solar:arrow-down-linear"}
                            width={12}
                          />
                          {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hasData ? (
          <div className="flex-1 min-h-[300px] overflow-x-auto">
            <div style={{ minWidth: Math.min(Math.max(chartData.length * 10, 500), 1200) }}>
            <ResponsiveContainer
              className="[&_.recharts-surface]:outline-hidden"
              height={300}
              width="100%"
            >
              <AreaChart
                key={activeMetric}
                accessibilityLayer
                data={chartData}
                margin={{ left: 0, right: 0 }}
              >
                <defs>
                  {accounts.length === 0 && (
                    <linearGradient
                      id="gradient-total"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="10%" stopColor={TOTAL_COLOR} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={TOTAL_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  )}
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
                        <stop offset="10%" stopColor={color} stopOpacity={0.1} />
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
 if (!hourKey) return null;
 const label = formatHourKey(hourKey);
 const tipData = tooltipByHour[hourKey];
 const tipChange = tooltipChangeByHour[hourKey];
 const overlayEntries = payload?.filter((p) => p.dataKey !== "total") ?? [];

 const renderChange = (change: number | null | undefined) => {
 if (change == null) return null;
 const isUp = change >= 0;
 return (
 <span className={cn(
 "text-[10px] font-semibold inline-flex items-center gap-0.5 px-1 py-px rounded",
 isUp ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
 )}>
 <Icon icon={isUp ? "solar:arrow-up-linear" : "solar:arrow-down-linear"} width={8} />
 {Math.abs(change).toFixed(0)}%
 </span>
 );
 };

 const metricRows = tipData ? [
 { label: "Views", value: tipData.views, change: tipChange?.views, icon: "solar:eye-bold" },
 { label: "Likes", value: tipData.likes, change: tipChange?.likes, icon: "solar:heart-bold" },
 { label: "Comments", value: tipData.comments, change: tipChange?.comments, icon: "solar:chat-round-dots-bold" },
 ] : [];

 return (
 <div className="rounded-xl bg-foreground shadow-lg min-w-[200px] overflow-hidden">
 {/* Header */}
 <div className="px-3 py-2 border-b border-foreground-200/10">
 <span className="text-xs text-muted font-medium">
 {label.date} &middot; {label.time}
 </span>
 </div>

 <div className="px-3 py-2 flex flex-col gap-y-2">
 {/* Metric rows */}
 {metricRows.map((m) => (
 <div key={m.label} className="flex items-center justify-between gap-x-4">
 <div className="flex items-center gap-1.5">
 <Icon icon={m.icon} width={12} className="text-muted" />
 <span className="text-xs text-muted">{m.label}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="text-sm text-background font-semibold">
 {formatChartValue(m.value)}
 </span>
 {renderChange(m.change)}
 </div>
 </div>
 ))}

 {/* Account breakdown */}
 {overlayEntries.length > 0 && (
 <div className="border-t border-foreground-200/10 pt-2 mt-0.5 flex flex-col gap-y-1.5">
 {overlayEntries.map((p, index) => {
 const account = accounts.find(
 (a) => `account_${a.id}` === p.dataKey
 );
 return (
 <div
 key={index}
 className="flex items-center justify-between gap-x-3"
 >
 <div className="flex items-center gap-1.5">
 <span
 className="inline-block w-2 h-2 rounded-full flex-shrink-0"
 style={{ backgroundColor: p.color }}
 />
 <span className="text-xs text-muted truncate max-w-[120px]">
 @{account?.username || "Unknown"}
 </span>
 </div>
 <span className="text-xs text-background font-semibold">
 {formatChartValue(p.value as number)}
 </span>
 </div>
 );
 })}
 </div>
 )}

 {/* All accounts label when no selection */}
 {accounts.length === 0 && (
 <div className="border-t border-foreground-200/10 pt-1.5 mt-0.5">
 <div className="flex items-center gap-1.5">
 <span
 className="inline-block w-2 h-2 rounded-full"
 style={{ backgroundColor: TOTAL_COLOR }}
 />
 <span className="text-xs text-muted">
 All Accounts ({axisAccounts.length})
 </span>
 </div>
 </div>
 )}
 </div>
 </div>
 );
 }}
 cursor={{ stroke: "hsl(var(--heroui-default-300))", strokeWidth: 1, strokeDasharray: "4 4" }}
 />
                {/* Individual overlay account lines (rendered first = below) */}
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
                      strokeWidth={2}
                      type="monotone"
                    />
                  );
                })}
                {/* Total aggregated line — only when no individual accounts selected */}
                {accounts.length === 0 && (
                  <Area
                    key="total"
                    activeDot={{
                      stroke: TOTAL_COLOR,
                      strokeWidth: 2,
                      fill: "hsl(var(--heroui-background))",
                      r: 4,
                    }}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                    dataKey="total"
                    fill="url(#gradient-total)"
                    stroke={TOTAL_COLOR}
                    strokeWidth={2.5}
                    type="monotone"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            </div>
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
