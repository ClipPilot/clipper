"use client";

import { useMemo } from "react";
import { Card, CardBody, Tooltip as HeroTooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
} from "recharts";
import type { ViralityAccount, AccountPostStats } from "@/api/virality";
import { formatNumber } from "@/lib/formatters";

const CHART_COLORS = [
  "#E1306C", // pink
  "#00F2EA", // cyan
  "#F77737", // orange
  "#833AB4", // purple
  "#22C55E", // green
  "#3B82F6", // blue
  "#FACC15", // yellow
  "#EF4444", // red
  "#A855F7", // violet
  "#14B8A6", // teal
  "#F97316", // amber
  "#6366F1", // indigo
];

interface ChartEntry {
  name: string;
  username: string;
  platform: "instagram" | "tiktok" | "x";
  value: number;
  fill: string;
}

function platformIcon(platform: "instagram" | "tiktok" | "x") {
  if (platform === "instagram") return "ri:instagram-fill";
  if (platform === "x") return "ri:twitter-x-fill";
  return "ri:tiktok-fill";
}

function platformIconColor(platform: "instagram" | "tiktok" | "x") {
  if (platform === "instagram") return "text-pink-500";
  if (platform === "x") return "text-foreground";
  return "text-cyan-400";
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
  total: number;
}

function CustomTooltip({ active, payload, total }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";

  return (
    <div className="rounded-medium bg-foreground text-tiny shadow-small min-w-[160px] p-2.5">
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
          @{entry.username}
        </span>
      </div>
      <div className="text-small text-background flex justify-between gap-4">
        <span>{formatNumber(entry.value)}</span>
        <span className="text-foreground-400">{pct}%</span>
      </div>
    </div>
  );
}

interface DonutChartCardProps {
  title: string;
  data: ChartEntry[];
  total: number;
  infoTooltip?: string;
}

function ChartTitle({ title, infoTooltip }: { title: string; infoTooltip?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      <p className="text-xs text-text-tertiary font-medium tracking-wide">
        {title}
      </p>
      {infoTooltip && (
        <HeroTooltip
          content={infoTooltip}
          placement="top"
          classNames={{ content: "max-w-[220px] text-tiny" }}
        >
          <span className="cursor-help">
            <Icon
              icon="solar:info-circle-linear"
              width={14}
              className="text-text-tertiary"
            />
          </span>
        </HeroTooltip>
      )}
    </div>
  );
}

function DonutChartCard({ title, data, total, infoTooltip }: DonutChartCardProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-surface-base border border-border-base">
        <CardBody className="p-5">
          <ChartTitle title={title} infoTooltip={infoTooltip} />
          <div className="flex flex-col items-center justify-center h-[280px] gap-3">
            <Icon
              icon="solar:chart-2-bold"
              width={40}
              className="text-text-tertiary"
            />
            <p className="text-sm text-text-tertiary text-center">
              Distribution data will appear after accounts are synced
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-base border border-border-base">
      <CardBody className="p-5">
        <ChartTitle title={title} infoTooltip={infoTooltip} />
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
                      Total
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
        <div className="max-h-[200px] overflow-y-auto mt-2 space-y-1.5">
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
                  @{entry.username}
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

interface DistributionChartsProps {
  accounts: ViralityAccount[];
  accountPostStats?: Record<number, AccountPostStats>;
}

export function DistributionCharts({ accounts, accountPostStats }: DistributionChartsProps) {
  const { viewsData, viewsTotal, likesData, likesTotal } =
    useMemo(() => {
      // Build a stable color map keyed by account id — same account gets same color in both charts
      const colorMap = new Map<number, string>();
      accounts.forEach((a, i) => {
        colorMap.set(a.id, CHART_COLORS[i % CHART_COLORS.length]);
      });

      const vData: ChartEntry[] = [];
      const lData: ChartEntry[] = [];
      let vTotal = 0;
      let lTotal = 0;

      for (const a of accounts) {
        const views = accountPostStats?.[a.id]?.totalViews ?? 0;
        const likes = a.total_likes ?? 0;
        const fill = colorMap.get(a.id)!;

        if (views > 0) {
          vData.push({
            name: `@${a.username}`,
            username: a.username,
            platform: a.platform,
            value: views,
            fill,
          });
          vTotal += views;
        }

        if (likes > 0) {
          lData.push({
            name: `@${a.username}`,
            username: a.username,
            platform: a.platform,
            value: likes,
            fill,
          });
          lTotal += likes;
        }
      }

      return {
        viewsData: vData,
        viewsTotal: vTotal,
        likesData: lData,
        likesTotal: lTotal,
      };
    }, [accounts, accountPostStats]);

  const allZero = viewsTotal === 0 && likesTotal === 0;

  if (allZero) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChartCard title="VIEWS DISTRIBUTION" data={[]} total={0} />
        <DonutChartCard title="LIKES DISTRIBUTION" data={[]} total={0} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DonutChartCard
        title="VIEWS DISTRIBUTION"
        data={viewsData}
        total={viewsTotal}
      />
      <DonutChartCard
        title="LIKES DISTRIBUTION"
        data={likesData}
        total={likesTotal}
      />
    </div>
  );
}
