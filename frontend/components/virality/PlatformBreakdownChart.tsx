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
import type { ViralityPost } from "@/api/virality";
import { formatNumber } from "@/lib/formatters";

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  tiktok: "#00F2EA",
  x: "#FFFFFF",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
};

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

interface PlatformEntry {
  name: string;
  platform: string;
  value: number;
  fill: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PlatformEntry }>;
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
        <span>{formatNumber(entry.value)} posts</span>
        <span className="text-foreground-400">{pct}%</span>
      </div>
    </div>
  );
}

interface PlatformBreakdownChartProps {
  posts: ViralityPost[];
  accountPlatformMap: Record<number, string>;
}

export function PlatformBreakdownChart({
  posts,
  accountPlatformMap,
}: PlatformBreakdownChartProps) {
  const { data, total } = useMemo(() => {
    const countByPlatform = new Map<string, number>();

    for (const post of posts) {
      const platform = accountPlatformMap[post.account_id] || "unknown";
      countByPlatform.set(platform, (countByPlatform.get(platform) || 0) + 1);
    }

    const entries: PlatformEntry[] = [];
    let sum = 0;

    countByPlatform.forEach((count, platform) => {
      entries.push({
        name: PLATFORM_LABELS[platform] || platform,
        platform,
        value: count,
        fill: PLATFORM_COLORS[platform] || "#6366F1",
      });
      sum += count;
    });

    return { data: entries, total: sum };
  }, [posts, accountPlatformMap]);

  if (data.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
            PLATFORM BREAKDOWN
          </p>
          <div className="flex flex-col items-center justify-center h-[280px] gap-3">
            <Icon
              icon="solar:chart-2-bold"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-sm text-text-tertiary text-center">
              Platform data will appear after syncing
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-5">
        <p className="text-xs text-text-tertiary font-medium tracking-wide mb-4">
          PLATFORM BREAKDOWN
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={60}
              outerRadius={100}
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
                      Posts
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
