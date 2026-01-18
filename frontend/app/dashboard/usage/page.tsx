"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Tabs,
  Tab,
  Progress,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { teamAPI, TeamUsageStats, UsageHistoryEntry } from "@/api/team";

type Period = "day" | "week" | "month";

function generateMockHistory(
  stats: TeamUsageStats | null,
  period: Period,
): UsageHistoryEntry[] {
  if (!stats) return [];

  const entries: UsageHistoryEntry[] = [];
  const now = new Date();
  const totalUsed = stats.clipsCreated || 0;

  const count = period === "day" ? 14 : period === "week" ? 8 : 6;
  const msPerPeriod =
    period === "day"
      ? 24 * 60 * 60 * 1000
      : period === "week"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  // Distribute usage across periods with weighted randomness
  const weights = Array.from({ length: count }, () => Math.random() + 0.2);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getTime() - i * msPerPeriod);
    const proportion = weights[i] / totalWeight;
    const creditsUsed = Math.round(totalUsed * proportion);

    entries.push({
      date: date.toISOString(),
      clipsCreated: Math.ceil(creditsUsed * 0.8),
      creditsUsed: Math.max(0, creditsUsed),
      generationsUsed: Math.ceil(creditsUsed * 0.3),
    });
  }

  return entries.reverse();
}

export default function UsagePage() {
  const router = useRouter();
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const [usageStats, setUsageStats] = useState<TeamUsageStats | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsageStats = useCallback(async () => {
    if (!selectedTeam?.id) return;
    try {
      const stats = await teamAPI.getTeamUsageStats(selectedTeam.id);
      setUsageStats(stats);
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
    }
  }, [selectedTeam?.id]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchUsageStats();
      setIsLoading(false);
    };
    loadData();
  }, [fetchUsageStats]);

  const history = useMemo(
    () => generateMockHistory(usageStats, period),
    [usageStats, period],
  );

  const usagePercentage = usageStats
    ? (usageStats.clipsCreated / usageStats.baseLimit) * 100
    : 0;

  const generationPercentage =
    usageStats && usageStats.generationLimit > 0
      ? (usageStats.clipsGenerated / usageStats.generationLimit) * 100
      : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "danger";
    if (percentage >= 70) return "warning";
    return "success";
  };

  const maxHistoryValue = Math.max(...history.map((h) => h.creditsUsed), 1);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (period === "month") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    if (period === "week") {
      return `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Spinner size="lg" color="primary" />
          <p className="text-text-secondary">Loading usage data...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 transition-colors"
          >
            <Icon
              icon="solar:arrow-left-linear"
              className="text-xl text-text-secondary"
            />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Usage & Analytics
            </h1>
            <p className="text-text-secondary text-sm">
              Track your credits, generations, and usage patterns
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-accent-400/20 text-accent-400 text-sm font-medium">
            {selectedTeam?.plan?.toUpperCase() || "FREE"}
          </div>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: "solar:credit-card-bold-duotone",
            color: "blue",
            label: "This period",
            value: usageStats?.clipsCreated || 0,
            title: "Credits used",
          },
          {
            icon: "solar:wallet-bold-duotone",
            color: "green",
            label: "Remaining",
            value: usageStats?.totalRemaining || 0,
            title: "Credits Left",
          },
          {
            icon: "solar:magic-stick-3-bold-duotone",
            color: "purple",
            label: "AI Used",
            value: usageStats?.clipsGenerated || 0,
            title: "Generations",
          },
          {
            icon: "solar:calendar-bold-duotone",
            color: "orange",
            label: "Resets",
            value: usageStats?.resetsDate
              ? new Date(usageStats.resetsDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—",
            title: "Next Billing",
            isDate: true,
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + index * 0.08 }}
          >
            <Card className="bg-surface-elevated border border-border-base hover:border-border-accent transition-colors">
              <CardBody className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`p-2.5 rounded-xl bg-gradient-to-br from-${stat.color}-500/20 to-${stat.color}-600/10`}
                  >
                    <Icon
                      icon={stat.icon}
                      className={`text-2xl text-${stat.color}-400`}
                    />
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {stat.label}
                  </span>
                </div>
                <p
                  className={`${stat.isDate ? "text-xl" : "text-3xl"} font-bold text-text-primary mb-1`}
                >
                  {stat.value}
                </p>
                <p className="text-sm text-text-secondary">{stat.title}</p>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Usage Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="bg-surface-elevated border border-border-base">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Credits Usage
                </h3>
                <span className="text-sm text-text-secondary">
                  {usageStats?.clipsCreated || 0} / {usageStats?.baseLimit || 0}
                </span>
              </div>
              <Progress
                value={Math.min(usagePercentage, 100)}
                color={getProgressColor(usagePercentage)}
                className="mb-4"
                size="lg"
              />
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-surface-base" />
                  <span className="text-text-secondary">
                    Base: {usageStats?.baseRemaining || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent-400" />
                  <span className="text-text-secondary">
                    Bonus: {usageStats?.addonRemaining || 0}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <Card className="bg-surface-elevated border border-border-base">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  AI Generations
                </h3>
                <span className="text-sm text-text-secondary">
                  {usageStats?.clipsGenerated || 0}
                  {usageStats?.generationLimit && usageStats.generationLimit > 0
                    ? ` / ${usageStats.generationLimit}`
                    : " / Unlimited"}
                </span>
              </div>
              <Progress
                value={
                  usageStats?.generationLimit === -1
                    ? 10
                    : Math.min(generationPercentage, 100)
                }
                color={
                  usageStats?.generationLimit === -1
                    ? "primary"
                    : getProgressColor(generationPercentage)
                }
                className="mb-4"
                size="lg"
              />
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Icon
                  icon="solar:info-circle-linear"
                  className="text-text-tertiary"
                />
                {usageStats?.generationLimit === -1
                  ? "Unlimited AI generations with your plan"
                  : `${usageStats?.generationsRemaining || 0} generations remaining`}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Usage History */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card className="bg-surface-elevated border border-border-base">
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">
                Usage History
              </h3>
              <Tabs
                selectedKey={period}
                onSelectionChange={(key) => setPeriod(key as Period)}
                size="sm"
                variant="solid"
                classNames={{
                  tabList: "bg-surface-base",
                  cursor: "bg-accent-400",
                  tab: "text-text-secondary data-[selected=true]:text-white",
                }}
              >
                <Tab key="day" title="Daily" />
                <Tab key="week" title="Weekly" />
                <Tab key="month" title="Monthly" />
              </Tabs>
            </div>

            {history.length === 0 || usageStats?.clipsCreated === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-64 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-surface-base flex items-center justify-center mb-4">
                  <Icon
                    icon="solar:chart-2-bold-duotone"
                    className="text-3xl text-text-tertiary"
                  />
                </div>
                <p className="text-text-secondary mb-2">No usage history yet</p>
                <p className="text-sm text-text-tertiary">
                  Your usage data will appear here once you start creating clips
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {history.map((entry, index) => (
                  <motion.div
                    key={entry.date}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.55 + index * 0.04 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-32 text-sm text-text-secondary shrink-0">
                      {formatDate(entry.date)}
                    </div>
                    <div className="flex-1 h-8 bg-surface-base rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max((entry.creditsUsed / maxHistoryValue) * 100, 2)}%`,
                        }}
                        transition={{
                          duration: 0.6,
                          delay: 0.6 + index * 0.04,
                          ease: "easeOut",
                        }}
                        className="h-full bg-gradient-to-r from-accent-400 to-accent-500 rounded-lg flex items-center justify-end pr-2"
                      >
                        {entry.creditsUsed > 0 &&
                          entry.creditsUsed / maxHistoryValue > 0.15 && (
                            <span className="text-xs font-medium text-white">
                              {entry.creditsUsed}
                            </span>
                          )}
                      </motion.div>
                    </div>
                    <div className="w-24 text-right">
                      <span className="text-sm font-medium text-text-primary">
                        {entry.creditsUsed}
                      </span>
                      <span className="text-xs text-text-tertiary ml-1">
                        credits
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Footer Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="flex items-center justify-center gap-4 mt-8"
      >
        <Button
          variant="flat"
          className="bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80"
          startContent={<Icon icon="solar:wallet-bold-duotone" />}
          onPress={() => router.push("/dashboard/pricing")}
        >
          Upgrade Plan
        </Button>
        <Button
          variant="flat"
          className="bg-surface-elevated text-text-secondary hover:bg-surface-elevated/80"
          startContent={<Icon icon="solar:chat-round-dots-bold-duotone" />}
          onPress={() => window.open("https://cuttr.com/contact", "_blank")}
        >
          Contact Support
        </Button>
      </motion.div>
    </motion.div>
  );
}
