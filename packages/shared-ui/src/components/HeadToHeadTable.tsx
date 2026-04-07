"use client";

import { cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "../lib/formatters";

export interface CompetitorMetrics {
  name: string;
  followers: number;
  totalViews: number;
  totalPosts: number;
  engRate: number;
  postsPerWeek: number;
  avgViews: number;
}

interface HeadToHeadTableProps {
  competitors: CompetitorMetrics[];
}

const METRICS: {
  key: keyof Omit<CompetitorMetrics, "name">;
  label: string;
  icon: string;
  format: (v: number) => string;
}[] = [
  { key: "followers", label: "Followers", icon: "solar:users-group-rounded-bold", format: formatNumber },
  { key: "totalViews", label: "Views", icon: "solar:eye-bold", format: formatNumber },
  { key: "totalPosts", label: "Posts", icon: "solar:document-bold", format: formatNumber },
  { key: "engRate", label: "Eng. Rate", icon: "solar:chart-bold", format: (v) => v.toFixed(2) + "%" },
  { key: "postsPerWeek", label: "Posts/Wk", icon: "solar:calendar-bold", format: (v) => String(v) },
  { key: "avgViews", label: "Avg. Views", icon: "solar:play-bold", format: formatNumber },
];

const ROW_COLORS = [
  "bg-accent-400",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-blue-500",
  "bg-pink-500",
];

export function HeadToHeadTable({ competitors }: HeadToHeadTableProps) {
  if (competitors.length === 0) return null;

  const winners: Record<string, number> = {};
  for (const metric of METRICS) {
    const values = competitors.map((c) => c[metric.key]);
    const max = Math.max(...values);
    const winnerIndices = values.reduce<number[]>((acc, v, i) => (v === max ? [...acc, i] : acc), []);
    if (winnerIndices.length === 1) winners[metric.key] = winnerIndices[0];
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">Head-to-Head Comparison</h2>
      <div className="bg-surface-base border border-border-base rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-base">
                <th className="text-left text-[11px] text-text-tertiary font-medium tracking-wider uppercase px-5 py-3.5 bg-surface-elevated">
                  Competitor
                </th>
                {METRICS.map((metric) => (
                  <th
                    key={metric.key}
                    className="text-center text-[11px] text-text-tertiary font-medium tracking-wider uppercase px-4 py-3.5 bg-surface-elevated"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Icon icon={metric.icon} width={13} className="text-text-tertiary opacity-60" />
                      {metric.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp, idx) => (
                <tr
                  key={comp.name}
                  className="border-b border-border-base last:border-b-0 hover:bg-surface-hover/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0",
                          ROW_COLORS[idx % ROW_COLORS.length]
                        )}
                      >
                        {comp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-text-primary truncate max-w-[140px]">
                        {comp.name}
                      </span>
                    </div>
                  </td>
                  {METRICS.map((metric) => {
                    const val = comp[metric.key];
                    const isWinner = winners[metric.key] === idx;
                    return (
                      <td key={metric.key} className="px-4 py-3.5 text-center">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isWinner ? "text-green-500" : "text-text-primary"
                          )}
                        >
                          {metric.format(val)}
                        </span>
                        {isWinner && (
                          <Icon
                            icon="solar:crown-bold"
                            width={12}
                            className="text-amber-400 inline-block ml-1 -mt-0.5"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
