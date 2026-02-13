"use client";

import { useMemo } from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
} from "recharts";
import type { ViralityAccount, ViralityPost } from "@/api/virality";
import { formatNumber } from "@/lib/formatters";
import { ACCOUNT_COLORS } from "./AnalyticsChart";

function platformIcon(platform: string) {
  if (platform === "instagram") return "ri:instagram-fill";
  if (platform === "x") return "ri:twitter-x-fill";
  return "ri:tiktok-fill";
}

function platformIconColor(platform: string) {
  if (platform === "instagram") return "text-pink-500";
  if (platform === "x") return "text-foreground";
  return "text-cyan-400";
}

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
    <div className="rounded-medium bg-foreground text-tiny shadow-small min-w-[140px] p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: entry.fill }}
        />
        <Icon
          icon={platformIcon(entry.platform)}
          width={14}
          className={platformIconColor(entry.platform)}
        />
        <span className="text-small text-background font-medium">
          {entry.name}
        </span>
      </div>
      <div className="text-small text-background flex justify-between gap-4">
        <span>{formatNumber(entry.value)} views</span>
        <span className="text-foreground-400">{pct}%</span>
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
        fill: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      });
      sum += views;
    });

    return { data: entries.filter((e) => e.value > 0), total: sum };
  }, [accounts, postsByAccount]);

  if (data.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base h-full">
        <CardBody className="p-5 h-full flex flex-col">
          <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
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
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base h-full">
      <CardBody className="p-5 h-full flex flex-col">
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
                <Icon
                  icon={platformIcon(entry.platform)}
                  width={14}
                  className={platformIconColor(entry.platform)}
                />
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
      </CardBody>
    </Card>
  );
}
