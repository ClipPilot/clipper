"use client";

import { Card, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { AccountStats } from "@/types/massPosting";

interface AccountStatCardsProps {
  stats: AccountStats;
}

export function AccountStatCards({ stats }: AccountStatCardsProps) {
  const cards = [
    {
      title: "TOTAL ACCOUNTS",
      value: stats.totalAccounts.toLocaleString(),
      icon: "solar:users-group-rounded-bold-duotone",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "TOTAL REPOSTS",
      value: stats.totalReposts.toLocaleString(),
      icon: "solar:repeat-bold-duotone",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
    },
    {
      title: "AVG POSTS/ACCT",
      value: stats.avgPostsPerAccount.toLocaleString(),
      icon: "solar:chart-bold-duotone",
      iconColor: "text-amber-400",
      iconBg: "bg-amber-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((stat) => (
        <Card
 key={stat.title}
 className="bg-surface-base border border-border-base"
 >
          <Card.Content className="p-4">
            <p className="text-[11px] text-text-tertiary font-medium tracking-wide mb-2">
              {stat.title}
            </p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-text-accent">
                {stat.value}
              </p>
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center",
                  stat.iconBg
                )}
              >
                <Icon
                  icon={stat.icon}
                  width={18}
                  className={stat.iconColor}
                />
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
