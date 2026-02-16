"use client";

import React, { useEffect } from "react";
import {
  Listbox,
  ListboxItem,
  type Selection,
  Progress,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";
import { useUsageStatsRefresh } from "@/contexts/UsageStatsContext";
import { useRouter, usePathname } from "next/navigation";
import { SIDEBAR_ITEMS } from "./constants";

export type SidebarProps = {
  canViewPricing?: boolean;
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ canViewPricing = true }, ref) => {
    const router = useRouter();
    const pathname = usePathname();
    const [selectedTeam] = useAtom(selectedTeamAtom);
    const { refreshTrigger } = useUsageStatsRefresh();
    const { usageStats, isLoading, error, refetch } = useUsageStats(
      selectedTeam?.id
    );

    const currentKey =
      [...SIDEBAR_ITEMS]
        .sort((a, b) => b.href.length - a.href.length)
        .find((item) => pathname.startsWith(item.href))?.key || "";

    const [selected, setSelected] = React.useState<React.Key>(currentKey);

    useEffect(() => {
      setSelected(currentKey);
    }, [currentKey]);

    useEffect(() => {
      if (refreshTrigger > 0) {
        refetch();
      }
    }, [refreshTrigger, refetch]);

    const usagePercentage = usageStats
      ? (usageStats.clipsCreated / usageStats.baseLimit) * 100
      : 0;

    const plan = selectedTeam?.plan || "free";
    const isPaidPlan = ["studio", "scale", "enterprise"].includes(plan);

    const getPlanName = () => {
      switch (plan) {
        case "enterprise":
          return "Enterprise";
        case "scale":
          return "Scale";
        case "studio":
          return "Studio";
        default:
          return "Free";
      }
    };

    const getPlanColor = () => {
      switch (plan) {
        case "enterprise":
          return "bg-emerald-500/10 text-emerald-500";
        case "scale":
          return "bg-purple-500/10 text-purple-500";
        case "studio":
          return "bg-accent-400/10 text-accent-400";
        default:
          return "bg-blue-500/10 text-blue-500";
      }
    };

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <Listbox
            ref={ref}
            aria-label="Navigation"
            selectedKeys={selected ? [selected] as unknown as Selection : []}
            selectionMode="single"
            variant="flat"
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0] as string;
              if (key) {
                setSelected(key);
                const item = SIDEBAR_ITEMS.find((i) => i.key === key);
                if (item?.href) router.push(item.href);
              }
            }}
            classNames={{
              list: "gap-1",
            }}
          >
            {SIDEBAR_ITEMS.map((item) => {
              const isSelected = selected === item.key;
              return (
                <ListboxItem
                  key={item.key}
                  textValue={item.title}
                  classNames={{
                    base: "px-3 py-2.5 rounded-lg data-[selected=true]:bg-accent-400/10 hover:bg-surface-elevated transition-colors",
                    title: cn(
                      "text-sm font-medium transition-colors",
                      isSelected ? "text-accent-400" : "text-text-primary"
                    ),
                  }}
                  startContent={
                    item.icon && (
                      <Icon
                        icon={item.icon}
                        width={20}
                        className={cn(
                          "transition-colors",
                          isSelected ? "text-accent-400" : "text-text-primary"
                        )}
                      />
                    )
                  }
                >
                  {item.title}
                </ListboxItem>
              );
            })}
          </Listbox>
        </div>

        {canViewPricing && selectedTeam && (
          <div className="px-4 pb-3">
            <button
              onClick={() => router.push("/dashboard/referrals")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
            >
              <Icon
                icon="solar:money-bag-bold-duotone"
                className="text-amber-500 flex-shrink-0"
                width={20}
              />
              <div className="flex-1 text-left">
                <p className="text-xs font-medium text-amber-500">
                  Referral Program
                </p>
                <p className="text-[10px] text-text-tertiary">
                  Earn credits & discounts
                </p>
              </div>
              <Icon
                icon="solar:arrow-right-bold"
                className="text-amber-500"
                width={14}
              />
            </button>
          </div>
        )}

        {!isLoading && !error && usageStats && selectedTeam && (
          <div className="p-4 border-t border-border-base">
            <div className="space-y-3">
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
                    getPlanColor()
                  )}
                >
                  {getPlanName()}
                </span>
                <span className="text-text-tertiary">
                  {usageStats.clipsCreated} / {usageStats.baseLimit}
                </span>
              </div>
              <Progress
                value={usagePercentage}
                color={
                  usagePercentage >= 100
                    ? "danger"
                    : usagePercentage >= 75
                      ? "warning"
                      : "primary"
                }
                size="sm"
                classNames={{
                  base: "w-full",
                  indicator: "transition-all",
                }}
              />
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

              {canViewPricing && (
                isPaidPlan ? (
                  <button
                    onClick={() => router.push("/dashboard/pricing")}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                      plan === "enterprise"
                        ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                        : plan === "scale"
                          ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
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
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
