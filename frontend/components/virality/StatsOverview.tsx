"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface StatsOverviewProps {
  targetsCount: number;
  maxTargets: number;
  totalFollowers: number;
  totalLikes: number;
  totalPosts: number;
}

export function StatsOverview({
  targetsCount,
  maxTargets,
  totalFollowers,
  totalLikes,
  totalPosts,
}: StatsOverviewProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const statCards = [
    {
      title: "TOTAL TARGETS",
      value: `${targetsCount} / ${maxTargets}`,
      icon: "solar:users-group-rounded-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "TOTAL FOLLOWERS",
      value: formatNumber(totalFollowers),
      icon: "solar:eye-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "TOTAL LIKES",
      value: formatNumber(totalLikes),
      icon: "solar:heart-bold",
      iconColor: "text-red-500",
      iconBg: "bg-red-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statCards.map((stat) => (
        <Card
          key={stat.title}
          className="bg-surface-base border border-border-base"
        >
          <CardBody className="p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                <Icon icon={stat.icon} width={24} className={stat.iconColor} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-text-tertiary font-medium tracking-wide mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-text-primary">
                  {stat.value}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
