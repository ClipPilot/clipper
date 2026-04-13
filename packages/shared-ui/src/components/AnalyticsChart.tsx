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
import type { ViralityAccount, ViralityPost } from "../lib/viralityTypes";
import { formatChartValue } from "../lib/formatters";
import { CHART_COLORS } from "../lib/platformUtils";
import { buildChartDataByAccount } from "../lib/viralityUtils";

type ChartMetricKey = "likes" | "comments" | "views";

const TOTAL_COLOR = "#8b5cf6";

function formatDayKey(dayKey: string) {
  const d = new Date(dayKey + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface AnalyticsChartProps {
  accounts: ViralityAccount[];
  postsByAccount: Record<number, ViralityPost[]>;
  allAccounts?: ViralityAccount[];
  allPostsByAccount?: Record<number, ViralityPost[]>;
  colorMap?: Record<number, string>;
  startDate?: string;
  endDate?: string;
  changeOverrides?: { views?: number | null; likes?: number | null; comments?: number | null };
}

export function AnalyticsChart({ accounts, postsByAccount, allAccounts, allPostsByAccount, colorMap, startDate, endDate, changeOverrides }: AnalyticsChartProps) {
  const [activeMetric, setActiveMetric] = useState<ChartMetricKey>("views");

  const getColor = (account: ViralityAccount, index: number) =>
    colorMap?.[account.id] ?? CHART_COLORS[index % CHART_COLORS.length];

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

  const hasSelection = accounts.length > 0;
  const totalsAccounts = hasSelection ? accounts : axisAccounts;
  const totalsPostsByAccount = hasSelection ? postsByAccount : axisPostsByAccount;

  const tooltipByDay = useMemo(() => {
    const map: Record<string, { views: number; likes: number; comments: number }> = {};
    const startStr = startDate ? new Date(startDate).toISOString().slice(0, 10) : undefined;
    const endStr = endDate ? new Date(endDate).toISOString().slice(0, 10) : undefined;

    for (const account of totalsAccounts) {
      const posts = totalsPostsByAccount[account.id] || [];
      for (const post of posts) {
        if (!post.metrics_history?.length) continue;
        const postDayMax = new Map<string, { views: number; likes: number; comments: number }>();
        for (const entry of post.metrics_history) {
          const day = entry.recorded_at.slice(0, 10);
          const views = entry.views ?? 0;
          const existing = postDayMax.get(day);
          if (!existing || views > existing.views) {
            postDayMax.set(day, { views, likes: entry.likes ?? 0, comments: entry.comments ?? 0 });
          }
        }
        const sortedDays = Array.from(postDayMax.keys()).sort();
        let prev = { views: 0, likes: 0, comments: 0 };
        for (const day of sortedDays) {
          const vals = postDayMax.get(day)!;
          const delta = {
            views: Math.max(vals.views - prev.views, 0),
            likes: Math.max(vals.likes - prev.likes, 0),
            comments: Math.max(vals.comments - prev.comments, 0),
          };
          prev = vals;
          if (startStr && day < startStr) continue;
          if (endStr && day > endStr) continue;
          if (!map[day]) map[day] = { views: 0, likes: 0, comments: 0 };
          map[day].views += delta.views;
          map[day].likes += delta.likes;
          map[day].comments += delta.comments;
        }
      }
    }
    return map;
  }, [totalsAccounts, totalsPostsByAccount, startDate, endDate]);

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
    const days = Object.keys(tooltipByDay).sort();
    if (days.length < 2) return { views: null, likes: null, comments: null };
    const today = tooltipByDay[days[days.length - 1]];
    const yesterday = tooltipByDay[days[days.length - 2]];
    const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;
    return {
      views: pct(today.views, yesterday.views),
      likes: pct(today.likes, yesterday.likes),
      comments: pct(today.comments, yesterday.comments),
    };
  }, [tooltipByDay]);

  const tooltipChangeByDay = useMemo(() => {
    const sorted = Object.keys(tooltipByDay).sort();
    const changeMap: Record<string, { views: number | null; likes: number | null; comments: number | null }> = {};
    const pct = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : null;
    for (let i = 0; i < sorted.length; i++) {
      const day = sorted[i];
      if (i === 0) {
        changeMap[day] = { views: null, likes: null, comments: null };
      } else {
        const prev = tooltipByDay[sorted[i - 1]];
        const cur = tooltipByDay[day];
        changeMap[day] = {
          views: pct(cur.views, prev.views),
          likes: pct(cur.likes, prev.likes),
          comments: pct(cur.comments, prev.comments),
        };
      }
    }
    return changeMap;
  }, [tooltipByDay]);

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
              <dt className="text-base text-text-primary font-medium">
                Analytics
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
                  <div
                    key={key}
                    className={cn(
                      "rounded-lg flex w-full flex-col gap-2 p-3 transition-all cursor-pointer border",
                      activeMetric === key
                        ? "bg-accent-400/10 border-accent-400/30"
                        : "bg-transparent border-transparent hover:bg-white/[0.03]"
                    )}
                    onClick={() => setActiveMetric(key)}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors inline-flex items-center gap-1",
                        activeMetric === key ? "text-accent-400" : "text-text-tertiary"
                      )}
                    >
                      {title}
                      {tooltip && (
                        <HTooltip>
                          <HTooltip.Trigger>
                            <span className="inline-flex cursor-help" tabIndex={0}>
                              <Icon
                                icon="solar:info-circle-linear"
                                width={14}
                                className="text-text-tertiary"
                              />
                            </span>
                          </HTooltip.Trigger>
                          <HTooltip.Content placement="top">{tooltip}</HTooltip.Content>
                        </HTooltip>
                      )}
                    </span>
                    <div className="flex items-center gap-x-3">
                      <span className="text-text-primary text-xl sm:text-3xl font-bold">
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
                  </div>
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
                  stroke="var(--border-base)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="hourKey"
                  tickLine={false}
                  style={{ fontSize: "11px" }}
                  tickFormatter={formatDayKey}
                  interval={chartData.length <= 7 ? 0 : Math.max(0, Math.floor(chartData.length / 7) - 1)}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={yDomain}
                  width={50}
                  style={{ fontSize: "11px" }}
                  tickFormatter={formatChartValue}
                />
                <Tooltip
 content={({ payload }) => {
 const dayKey = payload?.[0]?.payload?.hourKey;
 if (!dayKey) return null;
 const label = formatDayKey(dayKey);
 const tipData = tooltipByDay[dayKey];
 const tipChange = tooltipChangeByDay[dayKey];
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
 <div className="rounded-xl bg-surface-base border border-border-base shadow-xl min-w-[200px] overflow-hidden">
 <div className="px-3 py-2 border-b border-border-base">
 <span className="text-xs text-text-tertiary font-medium">
 {label}
 </span>
 </div>

 <div className="px-3 py-2 flex flex-col gap-y-2">
 {/* Metric rows */}
 {metricRows.map((m) => (
 <div key={m.label} className="flex items-center justify-between gap-x-4">
 <div className="flex items-center gap-1.5">
 <Icon icon={m.icon} width={12} className="text-text-tertiary" />
 <span className="text-xs text-text-tertiary">{m.label}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="text-sm text-text-primary font-semibold">
 {formatChartValue(m.value)}
 </span>
 {renderChange(m.change)}
 </div>
 </div>
 ))}

 {/* Account breakdown */}
 {overlayEntries.length > 0 && (
 <div className="border-t border-border-base pt-2 mt-0.5 flex flex-col gap-y-1.5">
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
 <span className="text-xs text-text-tertiary truncate max-w-[120px]">
 @{account?.username || "Unknown"}
 </span>
 </div>
 <span className="text-xs text-text-primary font-semibold">
 {formatChartValue(p.value as number)}
 </span>
 </div>
 );
 })}
 </div>
 )}

 {/* All accounts label when no selection */}
 {accounts.length === 0 && (
 <div className="border-t border-border-base pt-1.5 mt-0.5">
 <div className="flex items-center gap-1.5">
 <span
 className="inline-block w-2 h-2 rounded-full"
 style={{ backgroundColor: TOTAL_COLOR }}
 />
 <span className="text-xs text-text-tertiary">
 All Accounts ({axisAccounts.length})
 </span>
 </div>
 </div>
 )}
 </div>
 </div>
 );
 }}
 cursor={{ stroke: "var(--border-light)", strokeWidth: 1, strokeDasharray: "4 4" }}
 />
                {accounts.map((account, i) => {
                  const color = getColor(account, i);
                  return (
                    <Area
                      key={account.id}
                      activeDot={{
                        stroke: color,
                        strokeWidth: 2,
                        fill: "var(--surface-base)",
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
                {accounts.length === 0 && (
                  <Area
                    key="total"
                    activeDot={{
                      stroke: TOTAL_COLOR,
                      strokeWidth: 2,
                      fill: "var(--surface-base)",
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
