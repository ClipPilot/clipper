"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Button,
  Input,
  Tabs,
  Tab,
  addToast,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useTeams } from "@/hooks/useTeams";
import {
  viralityAPI,
  type CompetitorWithAccounts,
  type ViralityPost,
} from "@/api/virality";
import { formatNumber } from "@/lib/formatters";
import { CHART_COLORS } from "@/lib/platformUtils";
import {
  DateRangeFilter,
  type DateRangeValue,
} from "@/components/virality/DateRangeFilter";
import {
  type ComparisonMode,
} from "@/components/virality/ComparisonModeSelector";
import { StatCards, type StatCardItem } from "@/components/virality/StatCards";
import { PostsTable } from "@/components/virality/PostsTable";
import { AnalyticsChart } from "@/components/virality/AnalyticsChart";
import { PostFrequencyChart } from "@/components/virality/PostFrequencyChart";
import { AccountBreakdownChart } from "@/components/virality/AccountBreakdownChart";
import { BestPerformingAccounts } from "@/components/virality/BestPerformingAccounts";
import { RecalcOverlay } from "@/components/virality/RecalcOverlay";
import { findClosestEntry, getComparisonDate, pct, computePostsPerWeek } from "./utils";

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CompetitorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { selectedTeam } = useTeams();
  const competitorId = Number(params.competitorId);

  const [competitor, setCompetitor] = useState<CompetitorWithAccounts | null>(null);
  const [postsByAccount, setPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const initialLoadDone = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [activeAccountId, setActiveAccountId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>({ type: "last-sync" });

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || isNaN(competitorId)) return;
    if (initialLoadDone.current) setIsRecalculating(true);
    try {
      const comp = await viralityAPI.getCompetitor(selectedTeam.id, competitorId);
      setCompetitor(comp);

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
      addToast({ title: "Failed to load competitor", description: err.message, color: "danger" });
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
      initialLoadDone.current = true;
    }
  }, [selectedTeam?.id, competitorId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTabChange = (key: React.Key) => {
    setActiveAccountId(String(key));
  };

  const handleDateRangeChange = (value: DateRangeValue) => {
    setDateRange(value);
  };

  const handleSyncAll = async () => {
    if (!selectedTeam?.id || !competitor) return;
    setIsSyncing(true);
    try {
      for (const account of competitor.accounts) {
        await viralityAPI.syncAccount(selectedTeam.id, account.id);
      }
      addToast({ title: "Sync complete", color: "success" });
      await fetchData();
    } catch (err: any) {
      addToast({ title: "Sync failed", description: err.message, color: "danger" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveName = async () => {
    if (!selectedTeam?.id || !editName.trim()) return;
    try {
      await viralityAPI.updateCompetitor(selectedTeam.id, competitorId, { name: editName.trim() });
      setIsEditingName(false);
      addToast({ title: "Name updated", color: "success" });
      await fetchData();
    } catch (err: any) {
      addToast({ title: "Failed to update name", description: err.message, color: "danger" });
    }
  };

  // ─── Derived data ────────────────────────────────────────────────────────────

  const activeAccounts = useMemo(() => {
    if (!competitor) return [];
    if (activeAccountId === "all") return competitor.accounts;
    const id = Number(activeAccountId);
    return competitor.accounts.filter((a) => a.id === id);
  }, [competitor, activeAccountId]);

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
    const engRateChange = hasHistory && prevEngRate > 0 ? pct(latestEngRate, prevEngRate) : null;

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

  // ─── Loading / Error states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!competitor) {
    return (
      <div className="min-h-screen bg-surface-dark flex flex-col items-center justify-center gap-3">
        <Icon icon="solar:danger-triangle-linear" width={48} className="text-text-tertiary" />
        <p className="text-text-secondary">Competitor not found</p>
        <Button variant="flat" onPress={() => router.push("/dashboard/virality")}>
          Back to Competitors
        </Button>
      </div>
    );
  }

  // ─── Stat card data ──────────────────────────────────────────────────────────

  const statCards: StatCardItem[] = [
    {
      title: "TOTAL VIEWS",
      value: formatNumber(stats.totalViews),
      icon: "solar:eye-bold",
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
      change: stats.viewsChange,
      tooltip: "Only counts views on video posts (Reels)",
    },
    {
      title: "TOTAL ENGAGEMENTS",
      value: formatNumber(stats.totalEngagements),
      icon: "solar:heart-bold",
      iconColor: "text-red-500",
      iconBg: "bg-red-500/10",
      change: stats.engagementsChange,
      tooltip: "Sum of likes and comments",
    },
    {
      title: "TOTAL POSTS",
      value: formatNumber(activePosts.length),
      icon: "solar:document-bold",
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
      change: null,
    },
    {
      title: "FOLLOWERS",
      value: formatNumber(stats.followers),
      icon: "solar:users-group-rounded-bold",
      iconColor: "text-accent-400",
      iconBg: "bg-accent-400/10",
      change: stats.followersChange,
    },
    {
      title: "AVG ENG RATE",
      value: stats.engagementRate.toFixed(2) + "%",
      icon: "solar:chart-2-bold",
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10",
      change: stats.engRateChange,
      tooltip: "(Likes + Comments) / Views x 100",
    },
    {
      title: "CONTENT VELOCITY",
      value: String(postsPerWeek),
      icon: "solar:rocket-2-bold",
      iconColor: "text-purple-500",
      iconBg: "bg-purple-500/10",
      change: null,
      tooltip: "Average posts per week based on post date range",
    },
  ];

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
              variant="flat"
              isIconOnly
              className="bg-surface-base"
              onPress={() => router.push("/dashboard/virality")}
            >
              <Icon icon="solar:arrow-left-linear" width={20} />
            </Button>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    value={editName}
                    onValueChange={setEditName}
                    classNames={{ inputWrapper: "bg-surface-base border-border-base" }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                  />
                  <Button size="sm" isIconOnly variant="flat" className="bg-accent-400 text-white" onPress={handleSaveName}>
                    <Icon icon="solar:check-read-linear" width={16} />
                  </Button>
                  <Button size="sm" isIconOnly variant="flat" className="bg-surface-elevated" onPress={() => setIsEditingName(false)}>
                    <Icon icon="solar:close-circle-linear" width={16} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-text-primary">{competitor.name}</h1>
                  <Button
                    size="sm"
                    isIconOnly
                    variant="light"
                    onPress={() => { setEditName(competitor.name); setIsEditingName(true); }}
                  >
                    <Icon icon="solar:pen-2-linear" width={16} className="text-text-tertiary" />
                  </Button>
                </div>
              )}
              {competitor.description && (
                <p className="text-text-secondary text-sm">{competitor.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
            <Button
              className="bg-accent-400 text-white"
              startContent={
                isSyncing ? <Spinner size="sm" color="white" /> : <Icon icon="solar:refresh-bold" width={18} />
              }
              isDisabled={isSyncing || competitor.accounts.length === 0}
              onPress={handleSyncAll}
            >
              {isSyncing ? "Syncing..." : "Sync All"}
            </Button>
          </div>
        </div>

        {/* Account Tabs */}
        {competitor.accounts.length > 0 ? (
          <Tabs
            selectedKey={activeAccountId}
            onSelectionChange={handleTabChange}
            variant="underlined"
            classNames={{
              tabList: "border-b border-border-base",
              cursor: "bg-accent-400",
              tab: "text-text-tertiary data-[selected=true]:text-text-primary",
            }}
          >
            <Tab key="all" title="All Accounts" />
            {competitor.accounts.map((t) => (
              <Tab
                key={String(t.id)}
                title={
                  <div className="flex items-center gap-1.5">
                    <Icon
                      icon={t.platform === "tiktok" ? "ri:tiktok-fill" : t.platform === "x" ? "ri:twitter-x-fill" : "ri:instagram-fill"}
                      width={14}
                      className={t.platform === "tiktok" ? "text-cyan-500" : t.platform === "x" ? "text-foreground" : "text-pink-500"}
                    />
                    @{t.username}
                  </div>
                }
              />
            ))}
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Icon icon="solar:users-group-rounded-linear" width={40} className="text-text-tertiary" />
            <p className="text-text-secondary text-sm">No accounts in this competitor group yet</p>
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
                accounts={activeAccounts}
                postsByAccount={activePostsByAccount}
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
          {activeAccountId === "all" ? (
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
            key={activeAccountId + (dateRange.startDate || "") + (dateRange.endDate || "")}
            posts={activePosts}
            accountPlatformMap={accountPlatformMap}
            accountSyncMap={accountSyncMap}
            comparisonMode={comparisonMode}
            onComparisonModeChange={setComparisonMode}
          />
        </RecalcOverlay>
      </div>
    </motion.div>
  );
}
