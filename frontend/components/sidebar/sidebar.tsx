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

export type SidebarItem = {
  key: string;
  title: string;
  icon?: string;
  href?: string;
};

export type SidebarProps = {
  items: SidebarItem[];
  defaultSelectedKey: string;
  onSelect?: (key: string) => void;
  canViewPricing?: boolean;
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ items, defaultSelectedKey, onSelect, canViewPricing = true }, ref) => {
    const router = useRouter();
    const pathname = usePathname();
    const isComingSoonSelected = pathname === "/dashboard/coming-soon";
    const [selected, setSelected] =
      React.useState<React.Key>(isComingSoonSelected ? "" : defaultSelectedKey);
    const [selectedTeam] = useAtom(selectedTeamAtom);
    const { refreshTrigger } = useUsageStatsRefresh();
    const { usageStats, isLoading, error, refetch } = useUsageStats(
      selectedTeam?.id
    );

    // Sync selected state when pathname changes (e.g., navigating via links)
    useEffect(() => {
      if (isComingSoonSelected) {
        setSelected("");
      } else {
        setSelected(defaultSelectedKey);
      }
    }, [defaultSelectedKey, isComingSoonSelected]);

    useEffect(() => {
      if (refreshTrigger > 0) {
        refetch();
      }
    }, [refreshTrigger, refetch]);

    const usagePercentage = usageStats
      ? (usageStats.clipsCreated / usageStats.baseLimit) * 100
      : 0;

    const plan = selectedTeam?.plan || "free";
    const isPaidPlan = plan === "studio" || plan === "scale";

    const getPlanName = () => {
      switch (plan) {
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
            selectedKeys={[selected] as unknown as Selection}
            selectionMode="single"
            variant="flat"
            onSelectionChange={(keys) => {
              const key = Array.from(keys)[0];
              setSelected(key as React.Key);
              onSelect?.(key as string);
            }}
            classNames={{
              list: "gap-1",
            }}
          >
            {items.map((item) => (
              <ListboxItem
                key={item.key}
                textValue={item.title}
                classNames={{
                  base: "px-3 py-2.5 rounded-lg data-[selected=true]:bg-accent-400/10 hover:bg-surface-elevated transition-colors",
                  title:
                    "text-sm font-medium text-text-secondary data-[selected=true]:text-accent-400",
                }}
                startContent={
                  item.icon && (
                    <Icon
                      icon={item.icon}
                      width={20}
                      className="text-text-tertiary data-[selected=true]:text-accent-400"
                    />
                  )
                }
              >
                {item.title}
              </ListboxItem>
            ))}
          </Listbox>
        </div>

        {/* Coming Soon */}
        <div className="mt-auto px-4 pb-2">
          <button
            onClick={() => router.push("/dashboard/coming-soon")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
              isComingSoonSelected
                ? "bg-accent-400/10"
                : "hover:bg-surface-elevated"
            )}
          >
            <Icon
              icon="solar:stars-bold-duotone"
              className={isComingSoonSelected ? "text-accent-400" : "text-text-tertiary"}
              width={20}
            />
            <span className={cn(
              "text-sm font-medium",
              isComingSoonSelected ? "text-accent-400" : "text-text-secondary"
            )}>
              Coming Soon
            </span>
          </button>
        </div>

        {canViewPricing &&
          !isLoading &&
          !error &&
          selectedTeam &&
          !isPaidPlan && (
            <div className="p-4 border-t border-border-base">
              <button
                onClick={() => router.push("/dashboard/pricing")}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-accent-400/10 border border-accent-400/20 hover:bg-accent-400/20 transition-colors"
              >
                <Icon
                  icon="solar:rocket-bold-duotone"
                  className="text-accent-400 flex-shrink-0"
                  width={18}
                />
                <div className="flex-1 text-left">
                  <p className="text-xs font-medium text-accent-400">
                    Upgrade workspace
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    Unlimited clips
                  </p>
                </div>
                <Icon
                  icon="solar:arrow-right-bold"
                  className="text-accent-400"
                  width={14}
                />
              </button>
            </div>
          )}

        {canViewPricing &&
          !isLoading &&
          !error &&
          selectedTeam &&
          isPaidPlan && (
            <div className="mt-auto p-4 border-t border-border-base">
              <button
                onClick={() => router.push("/dashboard/pricing")}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  plan === "scale"
                    ? "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20"
                    : "bg-accent-400/10 border-accent-400/20 hover:bg-accent-400/20"
                )}
              >
                <Icon
                  icon="solar:verified-check-bold"
                  className={
                    plan === "scale" ? "text-purple-500" : "text-accent-400"
                  }
                  width={18}
                />
                <div className="flex-1 text-left">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      plan === "scale" ? "text-purple-500" : "text-accent-400"
                    )}
                  >
                    {getPlanName()} plan
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    Manage subscription
                  </p>
                </div>
                <Icon
                  icon="solar:arrow-right-bold"
                  className={
                    plan === "scale" ? "text-purple-500" : "text-accent-400"
                  }
                  width={14}
                />
              </button>
            </div>
          )}

        {!isLoading && !error && usageStats && selectedTeam && (
          <div className="p-4 border-t border-border-base">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-text-secondary font-medium truncate"
                    title={selectedTeam.name}
                  >
                    {selectedTeam.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0",
                      getPlanColor()
                    )}
                  >
                    {getPlanName()}
                  </span>
                </div>
                <span className="text-text-tertiary flex-shrink-0 ml-2">
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
                    ? `${usageStats.totalRemaining} clip${usageStats.totalRemaining !== 1 ? "s" : ""} left`
                    : "No clips left"}
                </p>
                {usageStats.addonRemaining > 0 && (
                  <span className="text-xs text-green-500 font-medium">
                    +{usageStats.addonRemaining} bonus
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
