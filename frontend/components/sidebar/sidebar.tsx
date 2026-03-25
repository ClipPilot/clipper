"use client";

import React, { useEffect } from "react";
import { ProgressBar, Tooltip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import { useRouter, usePathname } from "next/navigation";
import {
  SIDEBAR_SECTIONS,
  ALL_SIDEBAR_ITEMS,
  type SidebarItem,
  type SidebarSection,
} from "./constants";
import { getPlanName, getPlanColor, isPaidPlan } from "@/lib/plans";

export type SidebarProps = {
  isCollapsed?: boolean;
  canViewPricing?: boolean;
};

export default function Sidebar({
  isCollapsed = false,
  canViewPricing = true,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedTeam] = useAtom(selectedTeamAtom);
  const { refreshTrigger } = useUsageStatsRefresh();
  const { usageStats, isLoading, error, refetch } = useUsageStats(
    selectedTeam?.id
  );

  const plan = selectedTeam?.plan || "free";

  const isItemLocked = (item: SidebarItem) =>
    item.requiredPlans ? !item.requiredPlans.includes(plan) : false;

  const getUpgradePlanName = (item: SidebarItem) => {
    if (!item.requiredPlans) return "";
    const planNames: Record<string, string> = {
      creator: "Creator",
      studio: "Studio",
      scale: "Scale",
      enterprise: "Enterprise",
    };
    return planNames[item.requiredPlans[0]] || "a paid";
  };

  const currentKey =
    [...ALL_SIDEBAR_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname.startsWith(item.href))?.key || "";

  useEffect(() => {
    refetch();
  }, [refreshTrigger, pathname, refetch]);

  const usagePercentage = usageStats
    ? (usageStats.clipsCreated / usageStats.baseLimit) * 100
    : 0;

  const handleNav = (item: SidebarItem) => {
    if (isItemLocked(item)) {
      router.push("/dashboard/pricing");
      return;
    }
    router.push(item.href);
  };

  const renderItem = (item: SidebarItem) => {
    const isActive = currentKey === item.key;
    const locked = isItemLocked(item);

    const button = (
      <button
        key={item.key}
        onClick={() => handleNav(item)}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-lg transition-colors",
          isCollapsed ? "justify-center p-2" : "px-2.5 py-1.5",
          locked
            ? "opacity-50 hover:bg-surface-elevated"
            : isActive
              ? "bg-accent-400/10"
              : "hover:bg-surface-elevated"
        )}
      >
        <Icon
          icon={item.icon}
          width={18}
          className={cn(
            "flex-shrink-0 transition-colors",
            locked
              ? "text-text-tertiary"
              : isActive
                ? "text-accent-400"
                : "text-text-accent"
          )}
        />
        <span
          className={cn(
            "text-[13px] font-medium transition-all whitespace-nowrap",
            isCollapsed
              ? "w-0 opacity-0 overflow-hidden"
              : "w-auto opacity-100",
            locked
              ? "text-text-tertiary"
              : isActive
                ? "text-accent-400"
                : "text-text-accent"
          )}
        >
          {item.title}
        </span>
        {!isCollapsed && locked && (
          <Icon
            icon="solar:lock-keyhole-bold"
            width={14}
            className="text-text-tertiary ml-auto flex-shrink-0"
          />
        )}
      </button>
    );

    if (isCollapsed) {
      const tooltipContent = locked
        ? `${item.title} — Upgrade to ${getUpgradePlanName(item)}`
        : item.title;
      return (
        <Tooltip
 key={item.key}
 content={tooltipContent}
 placement="right"
 delay={200}
 >
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  const renderSection = (section: SidebarSection, idx: number) => (
    <div key={idx}>
      {idx > 0 && (
        isCollapsed ? (
          <div className="mx-3 my-2 border-t border-border-base" />
        ) : (
          section.title && (
            <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              {section.title}
            </p>
          )
        )
      )}
      <div className="flex flex-col gap-0.5">
        {section.items.map(renderItem)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 overflow-y-auto space-y-0.5">
        {SIDEBAR_SECTIONS.map(renderSection)}
      </nav>

      {!isLoading && !error && usageStats && selectedTeam && (
        <div
          className={cn(
            "border-t border-border-base",
            isCollapsed ? "p-2" : "p-4"
          )}
        >
          {isCollapsed ? (
            <Tooltip
 placement="right"
 content={
 <div className="space-y-1 py-1">
 <p className="font-medium">{selectedTeam.name}</p>
 <p className="text-text-tertiary">
 {getPlanName(plan)} — {usageStats.clipsCreated}/
 {usageStats.baseLimit} clips
 </p>
 {usageStats.totalRemaining > 0 && (
 <p className="text-text-tertiary">
 {usageStats.totalRemaining} credit
 {usageStats.totalRemaining !== 1 ? "s" : ""} remaining
 </p>
 )}
 </div>
 }
 >
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded font-medium",
                    getPlanColor(plan)
                  )}
                >
                  {getPlanName(plan)}
                </div>
                <ProgressBar
 value={usagePercentage}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
              </div>
            </Tooltip>
          ) : (
            <div className="space-y-2">
              <p
                className="text-xs text-text-secondary font-medium truncate"
                title={selectedTeam.name}
              >
                {selectedTeam.name}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                    getPlanColor(plan)
                  )}
                >
                  {getPlanName(plan)}
                </span>
                <span className="text-text-tertiary">
                  {usageStats.clipsCreated} / {usageStats.baseLimit}
                </span>
              </div>
              <ProgressBar
 value={usagePercentage}
 >
<ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
</ProgressBar>
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-tertiary">
                  {usageStats.totalRemaining > 0
                    ? `${usageStats.totalRemaining} credit${usageStats.totalRemaining !== 1 ? "s" : ""} remaining`
                    : "No credits left"}
                </p>
                {usageStats.addonRemaining > 0 && (
                  <span className="text-xs text-green-500 font-medium">
                    +{usageStats.addonRemaining} bonus
                  </span>
                )}
              </div>

              {canViewPricing &&
                (isPaidPlan(plan) ? (
                  <button
                    onClick={() => router.push("/dashboard/pricing")}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                      plan === "enterprise"
                        ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                        : plan === "scale"
                          ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                          : plan === "creator"
                            ? "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20"
                            : "bg-accent-400/10 border-accent-400/20 hover:bg-accent-400/20"
                    )}
                  >
                    <Icon
                      icon="solar:verified-check-bold"
                      className={
                        plan === "enterprise"
                          ? "text-emerald-500"
                          : plan === "scale"
                            ? "text-purple-500"
                            : plan === "creator"
                              ? "text-orange-500"
                              : "text-accent-400"
                      }
                      width={16}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        plan === "enterprise"
                          ? "text-emerald-500"
                          : plan === "scale"
                            ? "text-purple-500"
                            : plan === "creator"
                              ? "text-orange-500"
                              : "text-accent-400"
                      )}
                    >
                      Manage subscription
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/dashboard/pricing")}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-400/10 border border-accent-400/20 hover:bg-accent-400/20 transition-colors"
                  >
                    <Icon
                      icon="solar:arrow-up-bold"
                      className="text-accent-400"
                      width={14}
                    />
                    <span className="text-xs font-medium text-accent-400">
                      Upgrade workspace
                    </span>
                  </button>
                ))}
            </div>
          )}

          {isCollapsed && canViewPricing && !isPaidPlan(plan) && (
            <Tooltip
 content="Upgrade workspace"
 placement="right"
 >
              <button
                onClick={() => router.push("/dashboard/pricing")}
                className="w-full mt-2 flex items-center justify-center p-2 rounded-lg bg-accent-400/10 border border-accent-400/20 hover:bg-accent-400/20 transition-colors"
              >
                <Icon
                  icon="solar:arrow-up-bold"
                  className="text-accent-400"
                  width={16}
                />
              </button>
            </Tooltip>
          )}

          {isCollapsed && canViewPricing && isPaidPlan(plan) && (
            <Tooltip
 content="Manage subscription"
 placement="right"
 >
              <button
                onClick={() => router.push("/dashboard/pricing")}
                className={cn(
                  "w-full mt-2 flex items-center justify-center p-2 rounded-lg border transition-colors",
                  plan === "enterprise"
                    ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                    : plan === "scale"
                      ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                      : plan === "creator"
                        ? "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20"
                        : "bg-accent-400/10 border-accent-400/20 hover:bg-accent-400/20"
                )}
              >
                <Icon
                  icon="solar:verified-check-bold"
                  className={
                    plan === "enterprise"
                      ? "text-emerald-500"
                      : plan === "scale"
                        ? "text-purple-500"
                        : plan === "creator"
                          ? "text-orange-500"
                          : "text-accent-400"
                  }
                  width={16}
                />
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
