"use client";

import { Icon } from "@iconify/react";
import { formatNumber } from "@/lib/formatters";

interface StatsOverviewProps {
  accountsCount: number;
  totalFollowers: number;
  totalLikes: number;
  totalPosts: number;
  totalViews: number;
  avgViewsPerPost: number;
}

export function StatsOverview({
  accountsCount,
  totalFollowers,
  totalLikes,
  totalPosts,
  totalViews,
  avgViewsPerPost,
}: StatsOverviewProps) {
  const statCards = [
    {
      title: "TOTAL ACCOUNTS",
      value: String(accountsCount),
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
      title: "TOTAL VIEWS",
      value: formatNumber(totalViews),
      icon: "solar:play-bold",
      iconColor: "text-purple-500",
      iconBg: "bg-purple-500/10",
    },
    {
      title: "AVG VIEWS / POST",
      value: formatNumber(avgViewsPerPost),
      icon: "solar:chart-2-bold",
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
    },
    {
      title: "TOTAL POSTS",
      value: formatNumber(totalPosts),
      icon: "solar:document-bold",
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {statCards.map((stat) => (
        <div
 key={stat.title}
 className="rounded-xl border border-border-base bg-surface-base overflow-hidden"
 >
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                <Icon icon={stat.icon} width={24} className={stat.iconColor} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-text-tertiary font-medium tracking-wide mb-1 min-h-[2rem] flex items-end">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-text-primary">
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
