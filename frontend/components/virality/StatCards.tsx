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
  tooltip?: string;
}

interface StatCardsProps {
  items: StatCardItem[];
}

export function StatCards({ items }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((stat) => (
        <Card
          key={stat.title}
          className="bg-surface-base border border-border-base"
        >
          <CardBody className="p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                <Icon
                  icon={stat.icon}
                  width={24}
                  className={stat.iconColor}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-xs text-text-tertiary font-medium tracking-wide">
                    {stat.title}
                  </p>
                  {stat.tooltip && (
                    <HTooltip content={stat.tooltip} placement="top" size="sm">
                      <Icon
                        icon="solar:info-circle-linear"
                        width={12}
                        className="text-default-400 cursor-help"
                      />
                    </HTooltip>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-text-primary">
                    {stat.value}
                  </p>
                  {stat.change != null && (
                    <div
                      className={cn(
                        "flex items-center gap-0.5",
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
                        {Math.abs(stat.change).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
