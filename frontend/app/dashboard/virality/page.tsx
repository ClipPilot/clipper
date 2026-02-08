"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, useDisclosure, addToast, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  StatsOverview,
  TargetsTable,
  PlatformFilter,
  AddTargetModal,
} from "@/components/virality";
import type { Platform } from "@/components/virality/TargetsTable";
import { useTeams } from "@/hooks/useTeams";
import {
  viralityAPI,
  type CompetitorWithTargets,
  type DashboardStats,
  type ViralityCompetitor,
} from "@/api/virality";

export default function ViralityPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [competitors, setCompetitors] = useState<CompetitorWithTargets[]>([]);
  const [simpleCompetitors, setSimpleCompetitors] = useState<ViralityCompetitor[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const [competitorsList, stats] = await Promise.all([
        viralityAPI.getCompetitors(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id),
      ]);

      setSimpleCompetitors(competitorsList);
      setDashboardStats(stats);

      // For each competitor, fetch its targets to build CompetitorWithTargets
      const withTargets: CompetitorWithTargets[] = await Promise.all(
        competitorsList.map((c) =>
          viralityAPI.getCompetitor(selectedTeam.id, c.id)
        )
      );
      setCompetitors(withTargets);
    } catch (err: any) {
      addToast({
        title: "Failed to load data",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeam?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewDetails = (competitor: CompetitorWithTargets) => {
    router.push(`/dashboard/virality/${competitor.id}`);
  };

  const handleAddTarget = async (
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

    await viralityAPI.addTarget(
      selectedTeam.id,
      platform as "instagram",
      profileUrl,
      competitorId
    );

    addToast({ title: "Target added", color: "success" });
    await fetchData();
  };

  const handleSync = async (competitorId: number) => {
    if (!selectedTeam?.id) return;
    const competitor = competitors.find((c) => c.id === competitorId);
    if (!competitor) return;

    try {
      for (const target of competitor.targets) {
        await viralityAPI.syncTarget(selectedTeam.id, target.id);
      }
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

  const handleDelete = async (competitorId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.deleteCompetitor(selectedTeam.id, competitorId);
      addToast({ title: "Competitor deleted", color: "success" });
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
            <Input
              placeholder="Search across all targets..."
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
            <Button
              className="bg-accent-400 text-white"
              startContent={<Icon icon="solar:add-circle-bold" width={18} />}
              onPress={onOpen}
            >
              Add Target
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {dashboardStats && (
          <StatsOverview
            targetsCount={dashboardStats.targetsCount}
            maxTargets={dashboardStats.maxTargets}
            totalFollowers={dashboardStats.totalFollowers}
            totalLikes={dashboardStats.totalLikes}
            totalPosts={dashboardStats.totalPosts}
          />
        )}

        {/* Platform Filter */}
        <div className="flex items-center justify-between">
          <PlatformFilter
            selected={platformFilter}
            onChange={setPlatformFilter}
          />
        </div>

        {/* Competitors Table */}
        <TargetsTable
          competitors={competitors}
          platformFilter={platformFilter}
          searchQuery={searchQuery}
          onViewDetails={handleViewDetails}
          onSync={handleSync}
          onDelete={handleDelete}
        />
      </div>

      {/* Add Target Modal */}
      <AddTargetModal
        isOpen={isOpen}
        onClose={onClose}
        competitors={simpleCompetitors}
        onSubmit={handleAddTarget}
      />
    </motion.div>
  );
}
