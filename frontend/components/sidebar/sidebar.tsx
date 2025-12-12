"use client";

import React from "react";
import { Listbox, ListboxItem, ListboxSection, type Selection, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUsageStats } from "@/hooks/useUsageStats";
import { useAtom } from "jotai";
import { selectedTeamAtom } from "@/store/auth";

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
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  ({ items, defaultSelectedKey, onSelect }, ref) => {
    const [selected, setSelected] = React.useState<React.Key>(defaultSelectedKey);
    const [selectedTeam] = useAtom(selectedTeamAtom);
    const { usageStats, isLoading, error } = useUsageStats(selectedTeam?.id);

    const usagePercentage = usageStats
      ? (usageStats.clipsCreated / usageStats.limit) * 100
      : 0;

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
                  title: "text-sm font-medium text-text-secondary data-[selected=true]:text-accent-400",
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

        {/* Usage Stats Bar */}
        {!isLoading && !error && usageStats && selectedTeam && (
          <div className="mt-auto p-4 border-t border-surface-border">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary font-medium truncate" title={selectedTeam.name}>
                  {selectedTeam.name}
                </span>
                <span className="text-text-tertiary flex-shrink-0 ml-2">
                  {usageStats.clipsCreated} / {usageStats.limit}
                </span>
              </div>
              <Progress
                value={usagePercentage}
                color={usagePercentage >= 100 ? "danger" : usagePercentage >= 75 ? "warning" : "primary"}
                size="sm"
                classNames={{
                  base: "w-full",
                  indicator: "transition-all",
                }}
              />
              <p className="text-xs text-text-tertiary">
                {usageStats.remaining > 0
                  ? `${usageStats.remaining} clip${usageStats.remaining !== 1 ? "s" : ""} remaining`
                  : "No clips remaining"}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
