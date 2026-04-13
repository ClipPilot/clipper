"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, toast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import { userPerformanceAPI } from "@/api/userPerformance";
import type { ViralityPost, ViralityAccount } from "@/api/virality";
import { CHART_COLORS } from "@/lib/platformUtils";
import {
  DateRangeFilter,
  StatCards,
  PostsTable,
  AnalyticsChart,
  PostFrequencyChart,
  AccountBreakdownChart,
  BestPerformingAccounts,
  AccountFilterPopover,
  ViralityUpgradeWall,
  type ComparisonMode,
} from "@clipper/shared-ui";
import {
  pct,
  computePostsPerWeek,
  buildStatCards,
  findClosestEntry,
  getComparisonDate,
} from "@/app/dashboard/virality/[competitorId]/utils";
import { canAccessViralityTracker } from "@/lib/plans";

export default function ManagedAccountsDetailPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();

  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const initialLoadDone = useRef(false);
  const [accounts, setAccounts] = useState<ViralityAccount[]>([]);
  const [postsByAccount, setPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>({ type: "last-sync" });
  const [backfillDone, setBackfillDone] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan)) return;
    if (initialLoadDone.current && !silent) setIsRecalculating(true);
    try {
      if (!backfillDone) {
        await userPerformanceAPI.backfillManaged(selectedTeam.id);
        setBackfillDone(true);
      }

      const accts = await userPerformanceAPI.getAccounts(selectedTeam.id, "mass_posting");
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
      toast.danger("Failed to load managed accounts", { description: err.message });
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
      initialLoadDone.current = true;
    }
  }, [selectedTeam?.id, selectedTeam?.plan, dateRange, backfillDone]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeletePost = useCallback(async (postId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await userPerformanceAPI.deletePost(selectedTeam.id, postId);
      toast.success("Post removed");
      await fetchData(true);
    } catch (err: any) {
      toast.danger("Failed to delete post", { description: err.message });
    }
  }, [selectedTeam?.id, fetchData]);

  const activeAccounts = useMemo(() => {
    if (selectedAccountIds.length === 0) return accounts;
    return accounts.filter((a) => selectedAccountIds.includes(a.id));
  }, [accounts, selectedAccountIds]);

  const chartOverlayAccounts = useMemo(() => {
    if (selectedAccountIds.length === 0) return [];
    return accounts.filter((a) => selectedAccountIds.includes(a.id));
  }, [accounts, selectedAccountIds]);

  const chartOverlayPostsByAccount = useMemo(() => {
    const map: Record<number, ViralityPost[]> = {};
    for (const a of chartOverlayAccounts) map[a.id] = postsByAccount[a.id] || [];
    return map;
  }, [chartOverlayAccounts, postsByAccount]);

  const activePosts = useMemo(() => {
    const posts: ViralityPost[] = [];
    for (const a of activeAccounts) posts.push(...(postsByAccount[a.id] || []));
    return posts.sort((a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime());
  }, [activeAccounts, postsByAccount]);

  const activePostsByAccount = useMemo(() => {
    const map: Record<number, ViralityPost[]> = {};
    for (const a of activeAccounts) map[a.id] = postsByAccount[a.id] || [];
    return map;
  }, [activeAccounts, postsByAccount]);

  const allFilteredPostsByAccount = useMemo(() => {
    const map: Record<number, ViralityPost[]> = {};
    for (const a of accounts) map[a.id] = postsByAccount[a.id] || [];
    return map;
  }, [accounts, postsByAccount]);

  const accountPlatformMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const a of accounts) map[a.id] = a.platform;
    return map;
  }, [accounts]);

  const accountSyncMap = useMemo(() => {
    const map: Record<number, string | null> = {};
    for (const a of accounts) map[a.id] = a.last_synced_at;
    return map;
  }, [accounts]);

  const accountColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    accounts.forEach((a, i) => { map[a.id] = CHART_COLORS[i % CHART_COLORS.length]; });
    return map;
  }, [accounts]);

  const stats = useMemo(() => {
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
      prevLikes += prev.likes; prevComments += prev.comments; prevViews += prev.views ?? 0;
      latestLikes += latest.likes; latestComments += latest.comments; latestViews += latest.views ?? 0;
    }

    let prevFollowers = 0, latestFollowers = 0, hasFollowerHistory = false;
    for (const a of activeAccounts) {
      const fh = a.follower_history;
      if (!fh || fh.length < 2) continue;
      const latestF = fh[fh.length - 1];
      const prevF = comparisonDate === null ? fh[fh.length - 2] : findClosestEntry(fh, comparisonDate);
      if (!prevF) continue;
      hasFollowerHistory = true;
      prevFollowers += prevF.followers; latestFollowers += latestF.followers;
    }

    const totalEngagements = totalLikes + totalComments;
    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;
    const prevEngagements = prevLikes + prevComments;
    const latestEngagements = latestLikes + latestComments;
    const prevEngRate = prevViews > 0 ? (prevEngagements / prevViews) * 100 : 0;
    const latestEngRate = latestViews > 0 ? (latestEngagements / latestViews) * 100 : 0;

    return {
      followers,
      totalLikes,
      totalComments,
      totalViews,
      totalEngagements,
      engagementsChange: hasHistory ? pct(latestEngagements, prevEngagements) : null,
      engagementRate,
      engRateChange: hasHistory ? latestEngRate - prevEngRate : null,
      followersChange: hasFollowerHistory ? pct(latestFollowers, prevFollowers) : null,
      viewsChange: hasHistory ? pct(latestViews, prevViews) : null,
    };
  }, [activeAccounts, activePosts, comparisonMode]);

  const postsPerWeek = useMemo(() => computePostsPerWeek(activePosts), [activePosts]);
  const statCards = buildStatCards(stats, activePosts.length, postsPerWeek);

  if (!canAccessViralityTracker(selectedTeam?.plan)) return <ViralityUpgradeWall />;
  if (isLoading) return <PageLoader />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-surface-dark p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="tertiary" isIconOnly className="!bg-transparent text-text-secondary hover:text-text-primary" onPress={() => router.push("/dashboard/your-performance")}>
              <Icon icon="solar:arrow-left-linear" width={20} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-cyan-500 text-cyan-500 bg-cyan-500/10">
                  <Icon icon="solar:server-bold-duotone" width={14} />
                </div>
                <h1 className="text-2xl font-bold text-text-primary">Cuttr Managed</h1>
              </div>
              <p className="text-text-tertiary text-xs mt-0.5 ml-10">
                {accounts.length} account{accounts.length !== 1 ? "s" : ""} posting on your behalf
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {accounts.length > 0 && (
          <AccountFilterPopover accounts={accounts} selectedAccountIds={selectedAccountIds} onChange={setSelectedAccountIds} />
        )}

        <StatCards items={statCards} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <div className="lg:col-span-2">
            <AnalyticsChart
              accounts={chartOverlayAccounts}
              postsByAccount={chartOverlayPostsByAccount}
              allAccounts={accounts}
              allPostsByAccount={allFilteredPostsByAccount}
              colorMap={accountColorMap}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
            />
          </div>
          <div className="lg:col-span-1">
            <AccountBreakdownChart accounts={activeAccounts} postsByAccount={activePostsByAccount} />
          </div>
        </div>

        {selectedAccountIds.length === 0 || selectedAccountIds.length > 1 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <PostFrequencyChart posts={activePosts} startDate={dateRange.startDate} endDate={dateRange.endDate} />
            <BestPerformingAccounts accounts={activeAccounts} postsByAccount={activePostsByAccount} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full">
            <PostFrequencyChart posts={activePosts} startDate={dateRange.startDate} endDate={dateRange.endDate} />
          </div>
        )}

        <PostsTable
          key={selectedAccountIds.join(",") + (dateRange.startDate || "") + (dateRange.endDate || "")}
          posts={activePosts}
          accountPlatformMap={accountPlatformMap}
          accountSyncMap={accountSyncMap}
          comparisonMode={comparisonMode}
          onComparisonModeChange={setComparisonMode}
          onDeletePost={handleDeletePost}
        />
      </div>
    </motion.div>
  );
}
