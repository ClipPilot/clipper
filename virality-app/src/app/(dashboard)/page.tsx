"use client";

import { useState } from "react";
import { Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { StatCards, HeadToHeadTable, AccountsTable, useViralityDateRange, CompetitorCard, ActivityFeed, PlatformFilter, type PlatformOption } from "@clipper/shared-ui";
import { DashboardHeader } from "@/components/DashboardHeader";
import { OverviewChart } from "@/components/OverviewChart";
import {
  MOCK_STATS,
  MOCK_COMPETITORS,
  MOCK_ACCOUNTS,
  MOCK_POSTS,
  MOCK_H2H,
  MOCK_CHART_DATA,
} from "@/lib/mock-data";

export default function Dashboard() {
  const [platformFilter, setPlatformFilter] = useState<PlatformOption>("all");
  const { dateRange, setDateRange } = useViralityDateRange();
  const [searchQuery, setSearchQuery] = useState("");

  const chartTotals = {
    views: MOCK_CHART_DATA.reduce((s, d) => s + d.views, 0),
    likes: MOCK_CHART_DATA.reduce((s, d) => s + d.likes, 0),
    comments: MOCK_CHART_DATA.reduce((s, d) => s + d.comments, 0),
  };

  const chartChanges = {
    views: 12.3,
    likes: 8.1,
    comments: 5.4,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <DashboardHeader
        title="Dashboard"
        subtitle="Track competitor performance and viral content across platforms"
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      <StatCards items={MOCK_STATS} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_COMPETITORS.map((c, i) => (
          <CompetitorCard key={c.id} data={c} index={i} />
        ))}
      </div>

      {MOCK_H2H.length >= 2 && <HeadToHeadTable competitors={MOCK_H2H} />}

      <OverviewChart
        data={MOCK_CHART_DATA}
        totals={chartTotals}
        changes={chartChanges}
      />

      <div className="flex items-center justify-between">
        <PlatformFilter value={platformFilter} onChange={setPlatformFilter} />
        <div className="relative max-w-xs">
          <Icon icon="solar:magnifer-linear" width={16} className="text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <AccountsTable
            accounts={MOCK_ACCOUNTS}
            platformFilter={platformFilter}
            searchQuery={searchQuery}
          />
        </div>
        <div>
          <ActivityFeed posts={MOCK_POSTS} />
        </div>
      </div>
    </div>
  );
}
