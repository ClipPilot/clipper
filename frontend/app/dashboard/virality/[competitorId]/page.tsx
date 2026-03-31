"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button,
  Input,
  toast,
  Spinner,
  Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import {
  viralityAPI,
  type CompetitorWithAccounts,
  type ViralityPost,
} from "@/api/virality";
import { CHART_COLORS, timeAgo, platformIcon, platformIconColor } from "@/lib/platformUtils";
import { DateRangeFilter } from "@/components/virality/DateRangeFilter";
import { type ComparisonMode } from "@/components/virality/ComparisonModeSelector";
import { StatCards } from "@/components/virality/StatCards";
import { PostsTable } from "@/components/virality/PostsTable";
import { AnalyticsChart } from "@/components/virality/AnalyticsChart";
import { PostFrequencyChart } from "@/components/virality/PostFrequencyChart";
import { AccountBreakdownChart } from "@/components/virality/AccountBreakdownChart";
import { BestPerformingAccounts } from "@/components/virality/BestPerformingAccounts";
import { RecalcOverlay } from "@/components/virality/RecalcOverlay";
import { AccountFilterPopover } from "@/components/virality/AccountFilterPopover";
import { ViralityUpgradeWall } from "@/components/virality/ViralityUpgradeWall";
import {
  findClosestEntry,
  getComparisonDate,
  pct,
  computePostsPerWeek,
  buildStatCards,
  getNextSyncCountdown,
} from "./utils";
import { canAccessViralityTracker } from "@/lib/plans";
import { useViralitySync } from "@/hooks/useViralitySyncSocket";

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CompetitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();
  const competitorId = Number(params.competitorId);

  const [competitor, setCompetitor] = useState<CompetitorWithAccounts | null>(null);
  const [postsByAccount, setPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const initialLoadDone = useRef(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>(() => {
    const accountId = searchParams.get("accountId");
    return accountId ? [Number(accountId)] : [];
  });
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>({ type: "last-sync" });

  const fetchData = useCallback(async (silent = false) => {
    if (!selectedTeam?.id || isNaN(competitorId) || !canAccessViralityTracker(selectedTeam.plan)) return;
    if (initialLoadDone.current && !silent) setIsRecalculating(true);
    try {
      const comp = await viralityAPI.getCompetitor(selectedTeam.id, competitorId);
      setCompetitor(comp);
      reconcileSync(comp.accounts);

      const { startDate, endDate } = dateRange;
      const postsMap: Record<number, ViralityPost[]> = {};
      await Promise.all(
        comp.accounts.map(async (a) => {
          const posts = await viralityAPI.getAccountPosts(
            selectedTeam.id, a.id, 100, 0, startDate, endDate
          );
          postsMap[a.id] = posts;
        })
      );
      setPostsByAccount(postsMap);
    } catch (err: any) {
      toast.danger("Failed to load competitor", { description: err.message });
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
      initialLoadDone.current = true;
    }
  }, [selectedTeam?.id, competitorId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // No auto-select: chart shows aggregated total by default.
  // User can toggle individual accounts via the filter popover.

  // Global sync state — persists across page navigation
  const { startSync, isAnySyncing, getSyncingIds, reconcileSync } = useViralitySync();

  const allAccountIds = useMemo(() => {
    if (!competitor) return [];
    return competitor.accounts.map((a) => a.id);
  }, [competitor]);

  const isSyncing = isAnySyncing(allAccountIds);
  const syncingAccountIds = getSyncingIds(allAccountIds);

  // Refetch data when syncs complete (active syncing IDs change)
  const prevSyncingRef = useRef<number[]>([]);
  useEffect(() => {
    const prev = prevSyncingRef.current;
    const current = syncingAccountIds;
    const justFinished = prev.filter((id) => !current.includes(id));
    if (justFinished.length > 0) {
      fetchData(true);
    }
    prevSyncingRef.current = current;
  }, [syncingAccountIds, fetchData]);

  // Safety net: re-fetch once after 10 min to catch missed socket events
  const hasSyncing = syncingAccountIds.length > 0;
  useEffect(() => {
    if (!hasSyncing) return;
    const timeout = setTimeout(() => fetchData(true), 10 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [hasSyncing, fetchData]);

  const handleDeletePost = useCallback(async (postId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.deletePost(selectedTeam.id, postId);
      toast.success("Post removed from tracking");
      await fetchData(true);
    } catch (err: any) {
      toast.danger("Failed to delete post", { description: err.message });
    }
  }, [selectedTeam?.id, fetchData]);

  const handleSyncAll = async () => {
    if (!selectedTeam?.id || !competitor) return;
    const accountIds = competitor.accounts.map((a) => a.id);

    // Mark as syncing in global state immediately
    startSync(accountIds);

    try {
      // Fire-and-forget: all POST requests return 202 instantly
      await Promise.all(
        accountIds.map((id) => viralityAPI.syncAccount(selectedTeam.id, id))
      );
      toast("Sync started for all accounts");
    } catch (err: any) {
      toast.danger("Failed to start sync", { description: err.message });
    }
  };

  const handleSaveName = async () => {
    if (!selectedTeam?.id || !editName.trim()) return;
    try {
      await viralityAPI.updateCompetitor(selectedTeam.id, competitorId, { name: editName.trim() });
      setIsEditingName(false);
      toast.success("Name updated");
      await fetchData();
    } catch (err: any) {
      toast.danger("Failed to update name", { description: err.message });
    }
  };

  // ─── Derived data ────────────────────────────────────────────────────────────

  const activeAccounts = useMemo(() => {
    if (!competitor) return [];
    if (selectedAccountIds.length === 0) return competitor.accounts;
    return competitor.accounts.filter((a) => selectedAccountIds.includes(a.id));
  }, [competitor, selectedAccountIds]);

  /** Accounts to overlay as individual lines on the chart (empty = total only) */
  const chartOverlayAccounts = useMemo(() => {
    if (!competitor || selectedAccountIds.length === 0) return [];
    return competitor.accounts.filter((a) => selectedAccountIds.includes(a.id));
  }, [competitor, selectedAccountIds]);

  const chartOverlayPostsByAccount = useMemo(() => {
    const map: Record<number, ViralityPost[]> = {};
    for (const a of chartOverlayAccounts) {
      map[a.id] = postsByAccount[a.id] || [];
    }
    return map;
  }, [chartOverlayAccounts, postsByAccount]);

  const activePosts = useMemo(() => {
    const posts: ViralityPost[] = [];
    for (const a of activeAccounts) {
      const accountPosts = postsByAccount[a.id] || [];
      posts.push(...accountPosts);
    }
    return posts.sort(
      (a, b) => new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime()
    );
  }, [activeAccounts, postsByAccount]);

  const activePostsByAccount = useMemo(() => {
    const map: Record<number, ViralityPost[]> = {};
    for (const a of activeAccounts) {
      map[a.id] = postsByAccount[a.id] || [];
    }
    return map;
  }, [activeAccounts, postsByAccount]);

  /** All accounts' posts (filtered) — stable across tab switches, used for fixed chart axes */
  const allFilteredPostsByAccount = useMemo(() => {
    if (!competitor) return {};
    const map: Record<number, ViralityPost[]> = {};
    for (const a of competitor.accounts) {
      map[a.id] = postsByAccount[a.id] || [];
    }
    return map;
  }, [competitor, postsByAccount]);

  const accountPlatformMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (competitor) for (const a of competitor.accounts) map[a.id] = a.platform;
    return map;
  }, [competitor]);

  const accountSyncMap = useMemo(() => {
    const map: Record<number, string | null> = {};
    if (competitor) for (const a of competitor.accounts) map[a.id] = a.last_synced_at;
    return map;
  }, [competitor]);

  const accountColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (competitor) {
      competitor.accounts.forEach((a, i) => {
        map[a.id] = CHART_COLORS[i % CHART_COLORS.length];
      });
    }
    return map;
  }, [competitor]);

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
  }, [activeAccounts, activePosts, comparisonMode]);

  const postsPerWeek = useMemo(() => computePostsPerWeek(activePosts), [activePosts]);

  /** Most recent sync timestamp across this competitor's accounts */
  const lastSyncedAt = useMemo(() => {
    if (!competitor) return null;
    let latest: Date | null = null;
    for (const a of competitor.accounts) {
      if (a.last_synced_at) {
        const d = new Date(a.last_synced_at);
        if (!latest || d > latest) latest = d;
      }
    }
    return latest;
  }, [competitor]);

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (!canAccessViralityTracker(selectedTeam?.plan)) {
    return <ViralityUpgradeWall />;
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (!competitor) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center gap-3">
        <Icon icon="solar:danger-triangle-linear" width={48} className="text-text-tertiary" />
        <p className="text-text-secondary">Competitor not found</p>
        <Button variant="tertiary" onPress={() => router.push("/dashboard/virality")}>
          Back to Competitors
        </Button>
      </div>
    );
  }

  // ─── Stat card data ──────────────────────────────────────────────────────────

  const statCards = buildStatCards(stats, activePosts.length, postsPerWeek);

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
          <div className="flex items-center gap-4">
            <Button
 variant="tertiary"
 isIconOnly
 className="!bg-transparent text-text-secondary hover:text-text-primary"
 onPress={() => router.push("/dashboard/virality")}
 >
              <Icon icon="solar:arrow-left-linear" width={20} />
            </Button>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input onChange={(e) => (setEditName)(e.target.value)}
 value={editName}
 autoFocus
 onKeyDown={(e) => {
 if (e.key === "Enter") handleSaveName();
 if (e.key === "Escape") setIsEditingName(false);
 }}
 />
                  <Button size="sm" isIconOnly variant="tertiary" className="bg-accent-400 text-white" onPress={handleSaveName}>
                    <Icon icon="solar:check-read-linear" width={16} />
                  </Button>
                  <Button size="sm" isIconOnly variant="tertiary" className="bg-surface-elevated" onPress={() => setIsEditingName(false)}>
                    <Icon icon="solar:close-circle-linear" width={16} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-text-primary">{competitor.name}</h1>
                  <Button
 size="sm"
 isIconOnly
 variant="tertiary"
 onPress={() => { setEditName(competitor.name); setIsEditingName(true); }}
 >
                    <Icon icon="solar:pen-2-linear" width={16} className="text-text-tertiary" />
                  </Button>
                  {competitor.accounts.length === 1 ? (
                    <a href={competitor.accounts[0].profile_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" isIconOnly variant="tertiary">
                        <Icon icon="solar:arrow-right-up-linear" width={16} className="text-text-tertiary" />
                      </Button>
                    </a>
                  ) : competitor.accounts.length > 1 ? (
                    <Dropdown>
<Button size="sm" isIconOnly variant="tertiary">
                          <Icon icon="solar:arrow-right-up-linear" width={16} className="text-text-tertiary" />
                        </Button>
<Dropdown.Popover>

<Dropdown.Menu aria-label="Open profile">
                        {competitor.accounts.map((a) => (
                          <Dropdown.Item
                            key={a.id}
                            onPress={() => window.open(a.profile_url, "_blank", "noopener,noreferrer")}
                          >
                            <Icon icon={platformIcon(a.platform)} width={14} className={platformIconColor(a.platform)} />
                            {a.account_type === "hashtag"
                              ? `#${a.username}`
                              : a.account_type === "keyword"
                                ? a.username
                                : `@${a.username}`}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
</Dropdown.Popover>
                    </Dropdown>
                  ) : null}
                </div>
              )}
              {competitor.description && (
                <p className="text-text-secondary text-sm">{competitor.description}</p>
              )}
              <p className="text-text-tertiary text-xs mt-0.5">
                {lastSyncedAt ? (
                  <>
                    Last synced {timeAgo(lastSyncedAt.toISOString())} · Next sync in{" "}
                    {getNextSyncCountdown()}
                  </>
                ) : (
                  "No syncs yet"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <Button
 className="bg-accent-400 text-white"
 isDisabled={isSyncing || competitor.accounts.length === 0}
 onPress={handleSyncAll}
 >
              {isSyncing ? <Spinner size="sm" color="current" /> : <Icon icon="solar:refresh-bold" width={18} />}
              {isSyncing ? "Syncing..." : "Sync All"}
            </Button>
          </div>
        </div>

        {/* Account Filter */}
        {competitor.accounts.length > 0 ? (
          <AccountFilterPopover
            accounts={competitor.accounts}
            selectedAccountIds={selectedAccountIds}
            onChange={setSelectedAccountIds}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Icon icon="solar:users-group-rounded-linear" width={40} className="text-text-tertiary" />
            <p className="text-text-secondary text-sm">No accounts in this competitor group yet</p>
          </div>
        )}

        {/* Syncing accounts banner */}
        {syncingAccountIds.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-accent-400/30 bg-accent-400/5 px-4 py-3">
            <Spinner size="sm" color="accent" />
            <p className="text-sm text-text-secondary">
              Syncing{" "}
              {competitor.accounts
                .filter((a) => syncingAccountIds.includes(a.id))
                .map((a, i, arr) => (
                  <Fragment key={a.id}>
                    <span className="font-medium text-text-primary">
                      {a.account_type === "hashtag" ? "#" : "@"}{a.username}
                    </span>
                    {i < arr.length - 1 && ", "}
                  </Fragment>
                ))}
              &hellip; Data will appear once the sync is complete.
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <RecalcOverlay active={isRecalculating}>
          <StatCards items={statCards} />
        </RecalcOverlay>

        {/* Performance Over Time + Account Breakdown */}
        <RecalcOverlay active={isRecalculating}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            <div className="lg:col-span-2">
              <AnalyticsChart
                accounts={chartOverlayAccounts}
                postsByAccount={chartOverlayPostsByAccount}
                allAccounts={competitor.accounts}
                allPostsByAccount={allFilteredPostsByAccount}
                colorMap={accountColorMap}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
            </div>
            <div className="lg:col-span-1">
              <AccountBreakdownChart
                accounts={activeAccounts}
                postsByAccount={activePostsByAccount}
              />
            </div>
          </div>
        </RecalcOverlay>

        {/* Post Frequency + Best Performing Accounts */}
        <RecalcOverlay active={isRecalculating}>
          {!selectedAccountIds || selectedAccountIds.length === 0 || selectedAccountIds.length > 1 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PostFrequencyChart
                posts={activePosts}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <BestPerformingAccounts
                accounts={activeAccounts}
                postsByAccount={activePostsByAccount}
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full">
              <PostFrequencyChart
                posts={activePosts}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
            </div>
          )}
        </RecalcOverlay>

        {/* Top Performing Content Table */}
        <RecalcOverlay active={isRecalculating}>
          <PostsTable
            key={selectedAccountIds.join(",") + (dateRange.startDate || "") + (dateRange.endDate || "")}
            posts={activePosts}
            accountPlatformMap={accountPlatformMap}
            accountSyncMap={accountSyncMap}
            comparisonMode={comparisonMode}
            onComparisonModeChange={setComparisonMode}
            onDeletePost={handleDeletePost}
          />
        </RecalcOverlay>
      </div>
    </motion.div>
  );
}
