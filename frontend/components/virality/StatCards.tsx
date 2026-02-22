"use client";

import { Card, CardBody, Tooltip as HTooltip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface StatCardItem {
  title: string;
  value: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  change: number | null;
  absoluteChange?: boolean;
  tooltip?: string;
}

interface StatCardsProps {
  items: StatCardItem[];
}

export function StatCards({ items }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {items.map((stat) => (
        <Card
          key={stat.title}
          className="bg-surface-base border border-border-base h-full"
        >
          <CardBody className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${stat.iconBg} shrink-0`}>
                <Icon
                  icon={stat.icon}
                  width={20}
                  className={stat.iconColor}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-[11px] text-text-tertiary font-medium tracking-wide truncate">
                    {stat.title}
                  </p>
                  {stat.tooltip && (
                    <HTooltip content={stat.tooltip} placement="top" size="sm">
                      <Icon
                        icon="solar:info-circle-linear"
                        width={12}
                        className="text-default-400 cursor-help shrink-0"
                      />
                    </HTooltip>
                  )}
                </div>
                <p className="text-xl font-bold text-text-primary">
                  {stat.value}
                </p>
                {stat.change != null ? (
                  <div
                    className={cn(
                      "flex items-center gap-0.5 mt-1",
                      stat.change >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    <Icon
                      icon={
                        stat.change >= 0
                          ? "solar:arrow-up-linear"
                          : "solar:arrow-down-linear"
                      }
                      width={12}
                    />
                    <span className="text-xs font-medium">
                      {stat.absoluteChange ? (stat.change >= 0 ? "+" : "") + stat.change.toFixed(2) : Math.abs(stat.change).toFixed(1) + "%"}
                    </span>
                  </div>
                ) : (
                  <div className="h-5" />
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
