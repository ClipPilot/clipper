"use client";

import { useMemo } from "react";
import { Icon } from "@iconify/react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
} from "recharts";
import type { ViralityAccount, ViralityPost } from "../lib/viralityTypes";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor, CHART_COLORS } from "../lib/platformUtils";

interface AccountEntry {
  name: string;
  platform: string;
  value: number;
  fill: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: AccountEntry }>;
  total: number;
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";

  return (
    <div className="rounded-md bg-foreground text-xs shadow-small min-w-[140px] p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: entry.fill }}
        />
        {entry.platform !== "other" && (
          <Icon
            icon={platformIcon(entry.platform)}
            width={14}
            className={platformIconColor(entry.platform)}
          />
        )}
        <span className="text-sm text-background font-medium">
          {entry.name}
        </span>
      </div>
      <div className="text-sm text-background flex justify-between gap-4">
        <span>{formatNumber(entry.value)} views</span>
        <span className="text-muted">{pct}%</span>
      </div>
    </div>
  );
}

interface AccountBreakdownChartProps {
  accounts: ViralityAccount[];
  postsByAccount: Record<number, ViralityPost[]>;
}

export function AccountBreakdownChart({
  accounts,
  postsByAccount,
}: AccountBreakdownChartProps) {
  const { data, total } = useMemo(() => {
    const entries: AccountEntry[] = [];
    let sum = 0;

    accounts.forEach((account, i) => {
      const posts = postsByAccount[account.id] || [];
      const views = posts.reduce(
        (s, p) => s + (p.video_play_count || 0),
        0
      );
      entries.push({
        name: `@${account.username}`,
        platform: account.platform,
        value: views,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      });
      sum += views;
    });

    const sorted = entries.filter((e) => e.value > 0).sort((a, b) => b.value - a.value);

    const MAX_DISPLAY = 8;
    if (sorted.length > MAX_DISPLAY) {
      const top = sorted.slice(0, MAX_DISPLAY);
      const othersValue = sorted.slice(MAX_DISPLAY).reduce((s, e) => s + e.value, 0);
      const othersCount = sorted.length - MAX_DISPLAY;
      if (othersValue > 0) {
        top.push({
          name: `+${othersCount} others`,
          platform: "other",
          value: othersValue,
          fill: "#6b7280",
        });
      }
      return { data: top, total: sum };
    }

    return { data: sorted, total: sum };
  }, [accounts, postsByAccount]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden h-full">
        <div className="p-3 sm:p-5 h-full flex flex-col">
          <p className="text-xs text-text-tertiary font-medium tracking-wide mb-3 sm:mb-4">
            ACCOUNT BREAKDOWN
          </p>
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <Icon
              icon="solar:chart-2-bold"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-sm text-text-tertiary text-center">
              View data will appear after syncing
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden h-full">
      <div className="p-5 h-full flex flex-col">
        <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
          ACCOUNT BREAKDOWN
        </p>
        <div className="flex-1 flex flex-col justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
                <Label
                  position="center"
                  content={() => (
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      <tspan
                        x="50%"
                        dy="-0.4em"
                        className="fill-text-primary text-xl font-bold"
                      >
                        {formatNumber(total)}
                      </tspan>
                      <tspan
                        x="50%"
                        dy="1.4em"
                        className="fill-text-tertiary text-xs"
                      >
                        Views
                      </tspan>
                    </text>
                  )}
                />
              </Pie>
              <Tooltip
 content={<CustomTooltip total={total} />}
 wrapperStyle={{ pointerEvents: "none" }}
 animationDuration={0}
 isAnimationActive={false}
 />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-2 space-y-1.5">
          {data.map((entry, i) => {
            const pct =
              total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-sm px-1"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.fill }}
                />
                {entry.platform !== "other" && (
                  <Icon
                    icon={platformIcon(entry.platform)}
                    width={14}
                    className={platformIconColor(entry.platform)}
                  />
                )}
                <span className="text-text-primary truncate flex-1">
                  {entry.name}
                </span>
                <span className="text-text-secondary font-medium">
                  {formatNumber(entry.value)}
                </span>
                <span className="text-text-tertiary w-12 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
