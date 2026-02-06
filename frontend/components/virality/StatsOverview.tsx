"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface StatsOverviewProps {
  totalTargets: number;
  totalDailyViews: number;
  viewsChange: number;
  avgEngagement: number;
  engagementChange: number;
}

export function StatsOverview({
  totalTargets,
  totalDailyViews,
  viewsChange,
  avgEngagement,
  engagementChange,
}: StatsOverviewProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercent = (num: number) => {
    const sign = num >= 0 ? "+" : "";
    return `${sign}${num.toFixed(1)}%`;
  };

  const statCards = [
    {
      title: "TOTAL TARGETS",
      value: totalTargets.toString(),
      change: 2.1, // Dummy change for now
      icon: "solar:users-group-rounded-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "TOTAL DAILY VIEWS",
      value: formatNumber(totalDailyViews),
      change: viewsChange,
      icon: "solar:eye-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
    },
    {
      title: "AVG. ENGAGEMENT",
      value: `${avgEngagement.toFixed(1)}%`,
      change: engagementChange,
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
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-text-primary">
                    {stat.value}
                  </p>
                  <span
                    className={`text-sm font-medium ${
                      stat.change >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {formatPercent(stat.change)}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
