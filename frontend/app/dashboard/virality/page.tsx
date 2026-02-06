"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, useDisclosure } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  StatsOverview,
  TargetsTable,
  PlatformFilter,
  AddTargetModal,
} from "@/components/virality";
import type { Platform, TrackedTarget } from "@/components/virality/TargetsTable";

export default function ViralityPage() {
  const router = useRouter();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Dummy stats for now
  const dummyStats = {
    totalTargets: 12,
    totalDailyViews: 4800000,
    viewsChange: 15.4,
    avgEngagement: 6.2,
    engagementChange: -0.5,
  };

  const handleViewDetails = (target: TrackedTarget) => {
    router.push(`/dashboard/virality/${target.id}`);
  };

  const handleAddTarget = async (
    platform: "tiktok" | "instagram" | "x",
    profileUrl: string,
    options: { enableAlerts: boolean; minViews: string; minEngagement: string }
  ) => {
    console.log("Adding target:", { platform, profileUrl, options });
    // TODO: Call API to add target
  };

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
              Tracked Targets
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
        <StatsOverview {...dummyStats} />

        {/* Platform Filter */}
        <div className="flex items-center justify-between">
          <PlatformFilter
            selected={platformFilter}
            onChange={setPlatformFilter}
          />
        </div>

        {/* Targets Table */}
        <TargetsTable
          platformFilter={platformFilter}
          onViewDetails={handleViewDetails}
        />
      </div>

      {/* Add Target Modal */}
      <AddTargetModal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleAddTarget}
      />
    </motion.div>
  );
}
