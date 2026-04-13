"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Button, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatNumber } from "../lib/formatters";
import { platformIcon, platformIconColor } from "../lib/platformUtils";

export const AVATAR_COLORS = [
  "border-accent-400 text-accent-400",
  "border-purple-500 text-purple-500",
  "border-emerald-500 text-emerald-500",
  "border-amber-500 text-amber-500",
  "border-blue-500 text-blue-500",
  "border-pink-500 text-pink-500",
];

export interface CompetitorCardData {
  id: number;
  name: string;
  accountCount: number;
  followers: number;
  totalViews: number;
  engRate: number;
  avgViews: number;
  platforms: string[];
  followersChange: number | null;
  viewsChange: number | null;
  engRateChange: number | null;
  isMyPerformance?: boolean;
}

interface CompetitorCardProps {
  data: CompetitorCardData;
  index: number;
  isExpanded?: boolean;
  onView?: (id: number) => void;
  nameOverride?: ReactNode;
  actions?: ReactNode;
}

export function CompetitorCard({ data, index, onView, nameOverride, actions }: CompetitorCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const metrics: { label: string; value: string; change: number | null; absoluteChange?: boolean }[] = [
    { label: "Total Views", value: formatNumber(data.totalViews), change: data.viewsChange },
    { label: "Avg. Views", value: formatNumber(data.avgViews), change: null },
    { label: "Followers", value: formatNumber(data.followers), change: data.followersChange },
    { label: "Eng. Rate", value: data.engRate.toFixed(2) + "%", change: data.engRateChange, absoluteChange: true },
  ];

  return (
    <div className="rounded-xl border border-border-base bg-surface-base overflow-hidden">
      <div className="p-4 flex flex-col gap-0">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border-2 bg-transparent",
              data.isMyPerformance
                ? "border-accent-400 text-accent-400 bg-accent-400/10"
                : AVATAR_COLORS[index % AVATAR_COLORS.length]
            )}
          >
            {data.isMyPerformance ? (
              <Icon icon="solar:star-bold-duotone" width={18} />
            ) : (
              data.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            {nameOverride ?? (
              <>
                <p className="text-sm font-medium text-text-primary truncate">{data.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-text-tertiary">
                    {data.accountCount} account{data.accountCount !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    {data.platforms.map((p) => (
                      <Icon key={p} icon={platformIcon(p)} width={11} className={platformIconColor(p)} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {actions ?? (
            <Button
              size="sm"
              variant="tertiary"
              className="bg-accent-400/10 text-accent-400 text-[11px] h-7 min-w-0 px-2.5"
              onPress={() => onView?.(data.id)}
            >
              View
            </Button>
          )}
        </div>

        <motion.div
          initial={false}
          animate={{ height: isExpanded ? "auto" : 0, opacity: isExpanded ? 1 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-2 pt-3">
            {metrics.map((m) => (
              <div key={m.label} className="bg-surface-elevated rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-text-tertiary font-medium">{m.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-sm font-bold text-text-primary">{m.value}</p>
                  {m.change != null && (
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        m.change >= 0 ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {m.absoluteChange
                        ? (m.change >= 0 ? "+" : "") + m.change.toFixed(2)
                        : (m.change >= 0 ? "+" : "") + m.change.toFixed(1) + "%"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center pt-2 group cursor-pointer"
        >
          <div className="rounded-full p-1 transition-colors group-hover:bg-surface-elevated">
            <Icon
              icon="solar:alt-arrow-down-linear"
              width={16}
              className={cn(
                "text-text-tertiary transition-all group-hover:text-text-primary",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
