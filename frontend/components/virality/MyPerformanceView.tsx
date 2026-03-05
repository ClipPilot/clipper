"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Button,
  addToast,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import { userPerformanceAPI } from "@/api/userPerformance";
import type { ViralityAccount, ViralityPost } from "@/api/virality";
import { CHART_COLORS, timeAgo, platformIcon, platformIconColor } from "@/lib/platformUtils";
import { DateRangeFilter } from "@/components/virality/DateRangeFilter";
import { type ComparisonMode } from "@/components/virality/ComparisonModeSelector";
import { StatCards } from "@/components/virality/StatCards";
import { PostsTable } from "@/components/virality/PostsTable";
import { AnalyticsChart } from "@/components/virality/AnalyticsChart";
import { PostFrequencyChart } from "@/components/virality/PostFrequencyChart";
import { AccountBreakdownChart } from "@/components/virality/AccountBreakdownChart";
import { YourAccountsList } from "@/components/virality/YourAccountsList";
import { ActivityFeed } from "@/components/virality/ActivityFeed";
import { RecalcOverlay } from "@/components/virality/RecalcOverlay";
import { AccountFilterPopover } from "@/components/virality/AccountFilterPopover";
import { AddAccountModal } from "@/components/virality/AddAccountModal";
import { ViralityUpgradeWall } from "@/components/virality/ViralityUpgradeWall";
import {
  findClosestEntry,
  getComparisonDate,
  pct,
  computePostsPerWeek,
  buildStatCards,
  getNextSyncCountdown,
} from "@/app/dashboard/virality/[competitorId]/utils";
import { canAccessViralityTracker } from "@/lib/plans";

interface MyPerformanceViewProps {
  showBackButton?: boolean;
  backHref?: string;
}

export function MyPerformanceView({ showBackButton = false, backHref = "/dashboard/virality" }: MyPerformanceViewProps) {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [accounts, setAccounts] = useState<ViralityAccount[]>([]);
  const [postsByAccount, setPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const initialLoadDone = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>({ type: "last-sync" });

  const fetchData = useCallback(async (silent = false) => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan)) return;
    if (initialLoadDone.current && !silent) setIsRecalculating(true);
    try {
      const accts = await userPerformanceAPI.getAccounts(selectedTeam.id);
      setAccounts(accts);

      const { startDate, endDate } = dateRange;
      const postsMap: Record<number, ViralityPost[]> = {};
      await Promise.all(
        accts.map(async (a) => {
          const posts = await userPerformanceAPI.getAccountPosts(
            selectedTeam.id, a.id, 100, 0, startDate, endDate
          );
          postsMap[a.id] = posts;
        })
      );
      setPostsByAccount(postsMap);
    } catch (err: any) {
      addToast({ title: "Failed to load data", description: err.message, color: "danger" });
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
      initialLoadDone.current = true;
    }
  }, [selectedTeam?.id, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);


  const handleSyncAll = async () => {
    if (!selectedTeam?.id || accounts.length === 0) return;
    setIsSyncing(true);
    try {
      const results = await Promise.allSettled(
        accounts.map((account) => userPerformanceAPI.syncAccount(selectedTeam.id, account.id))
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        addToast({ title: `${failed.length} account(s) failed to sync`, color: "warning" });
      } else {
        addToast({ title: "Sync complete", color: "success" });
      }
      await fetchData();
    } catch (err: any) {
      addToast({ title: "Sync failed", description: err.message, color: "danger" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddAccount = async (
    platform: "tiktok" | "instagram" | "x",
    profileUrl: string,
    options: {
      enableAlerts: boolean;
      competitorId?: number;
      newCompetitorName?: string;
      accountType: "profile" | "hashtag" | "keyword";
    }
  ) => {
    if (!selectedTeam?.id) return;
    await userPerformanceAPI.addAccount(
      selectedTeam.id,
      platform,
      profileUrl,
      options.accountType
    );
    addToast({ title: "Account added", color: "success" });
    await fetchData();
  };

  // ─── Derived data ────────────────────────────────────────────────────────────

  const derived = useMemo(() => {
    const activeAccounts = selectedAccountIds.length === 0
      ? accounts
      : accounts.filter((a) => selectedAccountIds.includes(a.id));

    const posts: ViralityPost[] = [];
    for (const a of activeAccounts) posts.push(...(postsByAccount[a.id] || []));
    const activePosts = posts.sort(
      (a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime()
    );

    const activePostsByAccount: Record<number, ViralityPost[]> = {};
    for (const a of activeAccounts) activePostsByAccount[a.id] = postsByAccount[a.id] || [];

    const allFilteredPostsByAccount: Record<number, ViralityPost[]> = {};
    const accountPlatformMap: Record<number, string> = {};
    const accountSyncMap: Record<number, string | null> = {};
    const accountColorMap: Record<number, string> = {};
    const accountMap: Record<number, ViralityAccount> = {};
    let lastSyncedAt: Date | null = null;

    accounts.forEach((a, i) => {
      allFilteredPostsByAccount[a.id] = postsByAccount[a.id] || [];
      accountPlatformMap[a.id] = a.platform;
      accountSyncMap[a.id] = a.last_synced_at;
      accountColorMap[a.id] = CHART_COLORS[i % CHART_COLORS.length];
      accountMap[a.id] = a;
      if (a.last_synced_at) {
        const d = new Date(a.last_synced_at);
        if (!lastSyncedAt || d > lastSyncedAt) lastSyncedAt = d;
      }
    });

    return {
      activeAccounts, activePosts, activePostsByAccount, allFilteredPostsByAccount,
      accountPlatformMap, accountSyncMap, accountColorMap, accountMap, lastSyncedAt,
      postsPerWeek: computePostsPerWeek(activePosts),
    };
  }, [accounts, postsByAccount, selectedAccountIds]);

  const stats = useMemo(() => {
    const { activeAccounts, activePosts } = derived;
    const followers = activeAccounts.reduce((sum, a) => sum + (a.follower_count || 0), 0);
    const totalLikes = activePosts.reduce((sum, p) => sum + (p.like_count || 0), 0);
    const totalComments = activePosts.reduce((sum, p) => sum + (p.comment_count || 0), 0);
    const totalViews = activePosts.reduce((sum, p) => sum + (p.video_play_count || 0), 0);

    const comparisonDate = getComparisonDate(comparisonMode);

    let prevLikes = 0, prevComments = 0, prevViews = 0;
    let latestLikes = 0, latestComments = 0, latestViews = 0;
    let hasHistory = false;

    for (const post of activePosts) {
      const h = post.metrics_history;
      if (!h || h.length < 2) continue;
      const latest = h[h.length - 1];
      const prev = comparisonDate === null ? h[h.length - 2] : findClosestEntry(h, comparisonDate);
      if (!prev) continue;

      hasHistory = true;
      prevLikes += prev.likes;
      prevComments += prev.comments;
      prevViews += prev.views ?? 0;
      latestLikes += latest.likes;
      latestComments += latest.comments;
      latestViews += latest.views ?? 0;
    }

    let prevFollowers = 0, latestFollowers = 0;
    let hasFollowerHistory = false;
    for (const a of activeAccounts) {
      const fh = a.follower_history;
      if (!fh || fh.length < 2) continue;
      const latestF = fh[fh.length - 1];
      const prevF = comparisonDate === null ? fh[fh.length - 2] : findClosestEntry(fh, comparisonDate);
      if (!prevF) continue;
      hasFollowerHistory = true;
      prevFollowers += prevF.followers;
      latestFollowers += latestF.followers;
    }

    const totalEngagements = totalLikes + totalComments;
    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

    const prevEngagements = prevLikes + prevComments;
    const latestEngagements = latestLikes + latestComments;
    const engagementsChange = hasHistory ? pct(latestEngagements, prevEngagements) : null;

    const prevEngRate = prevViews > 0 ? (prevEngagements / prevViews) * 100 : 0;
    const latestEngRate = latestViews > 0 ? (latestEngagements / latestViews) * 100 : 0;
    const engRateChange = hasHistory ? latestEngRate - prevEngRate : null;

    return {
      followers, totalLikes, totalComments, totalViews,
      totalEngagements, engagementsChange, engagementRate, engRateChange,
      followersChange: hasFollowerHistory ? pct(latestFollowers, prevFollowers) : null,
      likesChange: hasHistory ? pct(latestLikes, prevLikes) : null,
      commentsChange: hasHistory ? pct(latestComments, prevComments) : null,
      viewsChange: hasHistory ? pct(latestViews, prevViews) : null,
    };
  }, [derived, comparisonMode]);

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (!canAccessViralityTracker(selectedTeam?.plan)) {
    return <ViralityUpgradeWall />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Stat card data ──────────────────────────────────────────────────────────

  const statCards = buildStatCards(stats, derived.activePosts.length, derived.postsPerWeek);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Button
                isIconOnly
                variant="light"
                className="text-text-secondary"
                onPress={() => router.push(backHref)}
              >
                <Icon icon="solar:arrow-left-linear" width={20} />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Your Performance</h1>
              <p className="text-text-secondary text-sm mt-1">
                Real-time performance metrics for your own accounts
              </p>
              {derived.lastSyncedAt !== null && (
                <p className="text-text-tertiary text-xs mt-0.5">
                  Last synced {timeAgo((derived.lastSyncedAt as Date).toISOString())} · Next sync in{" "}
                  {getNextSyncCountdown()}
                </p>
              )}
            </div>
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
            <Button
              className="bg-surface-base text-text-primary border border-border-base"
              startContent={
                isSyncing ? <Spinner size="sm" /> : <Icon icon="solar:refresh-bold" width={18} />
              }
              isDisabled={isSyncing || accounts.length === 0}
              onPress={handleSyncAll}
            >
              {isSyncing ? "Syncing..." : "Sync All"}
            </Button>
          </div>
        </div>

        {/* Account Filter */}
        {accounts.length > 0 ? (
          <AccountFilterPopover
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            onChange={setSelectedAccountIds}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Icon icon="solar:users-group-rounded-linear" width={40} className="text-text-tertiary" />
            <p className="text-text-secondary text-sm">No accounts added yet. Add your first account to get started.</p>
          </div>
        )}


        {/* Stats Cards + Best Performing Accounts */}
        <RecalcOverlay active={isRecalculating}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <StatCards items={statCards} gridClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" />
            <YourAccountsList
              accounts={derived.activeAccounts}
              postsByAccount={derived.activePostsByAccount}
              onAccountDeleted={fetchData}
            />
          </div>
        </RecalcOverlay>

        {/* Performance Over Time + Best Performing Content */}
        <RecalcOverlay active={isRecalculating}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            <div className="lg:col-span-2">
              <AnalyticsChart
                accounts={derived.activeAccounts}
                postsByAccount={derived.activePostsByAccount}
                allAccounts={accounts}
                allPostsByAccount={derived.allFilteredPostsByAccount}
                colorMap={derived.accountColorMap}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
            </div>
            <div className="lg:col-span-1">
              <ActivityFeed
                posts={derived.activePosts}
                allPosts={Object.values(postsByAccount).flat()}
                accountMap={derived.accountMap}
                dateRange={dateRange}
              />
            </div>
          </div>
        </RecalcOverlay>

        {/* Post Frequency + Account Breakdown */}
        <RecalcOverlay active={isRecalculating}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            <div className="lg:col-span-2">
              <PostFrequencyChart
                posts={derived.activePosts}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
            </div>
            <div className="lg:col-span-1">
              <AccountBreakdownChart
                accounts={derived.activeAccounts}
                postsByAccount={derived.activePostsByAccount}
              />
            </div>
          </div>
        </RecalcOverlay>

        {/* Top Performing Content Table (full width) */}
        <RecalcOverlay active={isRecalculating}>
          <PostsTable
            key={selectedAccountIds.join(",") + (dateRange.startDate || "") + (dateRange.endDate || "")}
            posts={derived.activePosts}
            accountPlatformMap={derived.accountPlatformMap}
            accountSyncMap={derived.accountSyncMap}
            comparisonMode={comparisonMode}
            onComparisonModeChange={setComparisonMode}
          />
        </RecalcOverlay>
      </div>

      <AddAccountModal
        isOpen={isOpen}
        onClose={onClose}
        hideCompetitorSelect
        onSubmit={handleAddAccount}
      />
    </motion.div>
  );
}
