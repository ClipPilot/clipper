"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, useDisclosure, addToast, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  StatsOverview,
  AccountsTable,
  PlatformFilter,
  AddAccountModal,
  DateRangeFilter,
  DistributionCharts,
} from "@/components/virality";
import type { Platform } from "@/components/virality/AccountsTable";
import type { DateRangeValue } from "@/components/virality/DateRangeFilter";
import { useTeams } from "@/hooks/useTeams";
import {
  viralityAPI,
  type CompetitorWithAccounts,
  type DashboardStats,
  type ViralityCompetitor,
} from "@/api/virality";

export default function ViralityPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [competitors, setCompetitors] = useState<CompetitorWithAccounts[]>([]);
  const [simpleCompetitors, setSimpleCompetitors] = useState<ViralityCompetitor[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const { startDate, endDate } = dateRange;
      const [competitorsList, stats] = await Promise.all([
        viralityAPI.getCompetitors(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
      ]);

      setSimpleCompetitors(competitorsList);
      setDashboardStats(stats);

      // For each competitor, fetch its accounts to build CompetitorWithAccounts
      const withAccounts: CompetitorWithAccounts[] = await Promise.all(
        competitorsList.map((c) =>
          viralityAPI.getCompetitor(selectedTeam.id, c.id)
        )
      );
      setCompetitors(withAccounts);
    } catch (err: any) {
      addToast({
        title: "Failed to load data",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewCompetitor = (competitorId: number) => {
    router.push(`/dashboard/virality/${competitorId}`);
  };

  const handleAddAccount = async (
    platform: "tiktok" | "instagram" | "x",
    profileUrl: string,
    options: {
      enableAlerts: boolean;
      competitorId?: number;
      newCompetitorName?: string;
    }
  ) => {
    if (!selectedTeam?.id) return;

    let competitorId = options.competitorId;

    // Create new competitor if needed
    if (!competitorId && options.newCompetitorName) {
      const competitor = await viralityAPI.createCompetitor(
        selectedTeam.id,
        options.newCompetitorName
      );
      competitorId = competitor.id;
    }

    if (!competitorId) {
      throw new Error("Please select or create a competitor group");
    }

    await viralityAPI.addAccount(
      selectedTeam.id,
      platform as "instagram" | "tiktok",
      profileUrl,
      competitorId
    );

    addToast({ title: "Account added", color: "success" });
    await fetchData();
  };

  const handleSyncAccount = async (accountId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.syncAccount(selectedTeam.id, accountId);
      addToast({ title: "Sync complete", color: "success" });
      await fetchData();
    } catch (err: any) {
      addToast({
        title: "Sync failed",
        description: err.message,
        color: "danger",
      });
    }
  };

  const handleDeleteAccount = async (accountId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.deleteAccount(selectedTeam.id, accountId);
      addToast({ title: "Account removed", color: "success" });
      await fetchData();
    } catch (err: any) {
      addToast({
        title: "Delete failed",
        description: err.message,
        color: "danger",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Tracked Competitors
            </h1>
            <p className="text-text-secondary mt-1">
              Real-time performance metrics for your monitored competitors
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <Button
              className="bg-accent-400 text-white"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={onOpen}
            >
              Add Account
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {dashboardStats && (
          <StatsOverview
            accountsCount={dashboardStats.accountsCount}
            maxAccounts={dashboardStats.maxAccounts}
            totalFollowers={dashboardStats.totalFollowers}
            totalLikes={dashboardStats.totalLikes}
            totalPosts={dashboardStats.totalPosts}
            totalViews={dashboardStats.totalViews}
            avgViewsPerPost={dashboardStats.avgViewsPerPost}
          />
        )}

        {/* Distribution Charts */}
        {dashboardStats && (
          <DistributionCharts accounts={dashboardStats.accounts} accountPostStats={dashboardStats.accountPostStats} />
        )}

        {/* Filters & Search */}
        <div className="flex items-center justify-between">
          <PlatformFilter
            selected={platformFilter}
            onChange={setPlatformFilter}
          />
          <Input
            placeholder="Search across all accounts..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={
              <Icon
                icon="solar:magnifer-linear"
                width={18}
                className="text-text-tertiary"
              />
            }
            classNames={{
              base: "w-72",
              inputWrapper: "bg-surface-base border-border-base",
            }}
          />
        </div>

        {/* Competitors Table */}
        <AccountsTable
          competitors={competitors}
          platformFilter={platformFilter}
          searchQuery={searchQuery}
          accountPostStats={dashboardStats?.accountPostStats}
          onViewCompetitor={handleViewCompetitor}
          onSyncAccount={handleSyncAccount}
          onDeleteAccount={handleDeleteAccount}
        />
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isOpen}
        onClose={onClose}
        competitors={simpleCompetitors}
        onSubmit={handleAddAccount}
      />
    </motion.div>
  );
}
