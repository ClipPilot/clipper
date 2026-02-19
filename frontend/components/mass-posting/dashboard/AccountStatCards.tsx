"use client";

import { Card, CardBody, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import { MOCK_ACCOUNT_STATS } from "./mockData";

interface StatItem {
  title: string;
  value: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  change: number;
}

const STATS: StatItem[] = [
  {
    title: "TOTAL ACCOUNTS",
    value: MOCK_ACCOUNT_STATS.totalAccounts.value.toLocaleString(),
    icon: "solar:users-group-rounded-bold-duotone",
    iconColor: "text-accent-400",
    iconBg: "bg-accent-400/10",
    change: MOCK_ACCOUNT_STATS.totalAccounts.change,
  },
  {
    title: "ACTIVE",
    value: MOCK_ACCOUNT_STATS.activeAccounts.value.toLocaleString(),
    icon: "solar:check-circle-bold-duotone",
    iconColor: "text-green-400",
    iconBg: "bg-green-400/10",
    change: MOCK_ACCOUNT_STATS.activeAccounts.change,
  },
  {
    title: "TOTAL REPOSTS",
    value: MOCK_ACCOUNT_STATS.totalReposts.value.toLocaleString(),
    icon: "solar:repost-bold",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    change: MOCK_ACCOUNT_STATS.totalReposts.change,
  },
  {
    title: "AVG POSTS/ACCT",
    value: MOCK_ACCOUNT_STATS.avgPostsPerAccount.value.toLocaleString(),
    icon: "solar:chart-bold-duotone",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10",
    change: MOCK_ACCOUNT_STATS.avgPostsPerAccount.change,
  },
];

export function AccountStatCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {STATS.map((stat) => (
        <Card
          key={stat.title}
          className="bg-surface-base border border-border-base"
        >
          <CardBody className="p-4">
            <p className="text-[11px] text-text-tertiary font-medium tracking-wide mb-2">
              {stat.title}
            </p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-text-primary">
                {stat.value}
              </p>
              <div
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  stat.change > 0
                    ? "text-green-500"
                    : stat.change < 0
                      ? "text-red-500"
                      : "text-text-tertiary"
                )}
              >
                {stat.change !== 0 && (
                  <Icon
                    icon={
                      stat.change > 0
                        ? "solar:arrow-up-linear"
                        : "solar:arrow-down-linear"
                    }
                    width={12}
                  />
                )}
                <span>~{Math.abs(stat.change).toFixed(0)}%</span>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
