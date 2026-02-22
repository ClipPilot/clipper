"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, useDisclosure, addToast, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  AccountsTable,
  PlatformFilter,
  AddAccountModal,
  DateRangeFilter,
  ActivityFeed,
  HeadToHeadTable,
  RecalcOverlay,
} from "@/components/virality";
import type { Platform } from "@/components/virality/AccountsTable";
import { CompetitorCard } from "@/components/virality/CompetitorCard";
import { ViralityUpgradeWall } from "@/components/virality/ViralityUpgradeWall";
import { useTeams } from "@/hooks/useTeams";
import { useViralityDateRange } from "@/contexts/ViralityContext";
import {
  viralityAPI,
  type CompetitorWithAccounts,
  type DashboardStats,
  type ViralityCompetitor,
  type ViralityPost,
  type ViralityAccount,
} from "@/api/virality";
import { pct, computePostsPerWeek } from "@/app/dashboard/virality/[competitorId]/utils";
import { canAccessViralityTracker } from "@/lib/plans";

export default function ViralityPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [competitors, setCompetitors] = useState<CompetitorWithAccounts[]>([]);
  const [simpleCompetitors, setSimpleCompetitors] = useState<ViralityCompetitor[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [postsByAccount, setPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [allPostsByAccountUnfiltered, setAllPostsByAccountUnfiltered] = useState<Record<number, ViralityPost[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [editingCompetitorId, setEditingCompetitorId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan)) return;
    if (initialLoadDone.current) setIsRecalculating(true);
    try {
      const { startDate, endDate } = dateRange;
      const [competitorsList, stats] = await Promise.all([
        viralityAPI.getCompetitors(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
      ]);

      setSimpleCompetitors(competitorsList);
      setDashboardStats(stats);

      const withAccounts: CompetitorWithAccounts[] = await Promise.all(
        competitorsList.map((c) =>
          viralityAPI.getCompetitor(selectedTeam.id, c.id)
        )
      );
      setCompetitors(withAccounts);

      // Fetch posts for all accounts (filtered + unfiltered for top content)
      const allAccounts = withAccounts.flatMap((c) => c.accounts);
      const postsMap: Record<number, ViralityPost[]> = {};
      const unfilteredMap: Record<number, ViralityPost[]> = {};
      const hasDateFilter = !!(startDate || endDate);
      await Promise.all(
        allAccounts.flatMap((a) => {
          const filtered = viralityAPI.getAccountPosts(
            selectedTeam.id, a.id, 50, 0, startDate, endDate
          ).then((posts) => { postsMap[a.id] = posts; });

          if (hasDateFilter) {
            const unfiltered = viralityAPI.getAccountPosts(
              selectedTeam.id, a.id, 100, 0
            ).then((posts) => { unfilteredMap[a.id] = posts; });
            return [filtered, unfiltered];
          }
          return [filtered];
        })
      );
      setPostsByAccount(postsMap);
      setAllPostsByAccountUnfiltered(hasDateFilter ? unfilteredMap : postsMap);
    } catch (err: any) {
      addToast({
        title: "Failed to load data",
        description: err.message,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
      setIsRecalculating(false);
      initialLoadDone.current = true;
    }
  }, [selectedTeam?.id, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build account lookup map for Top Performing Content
  const accountMap = useMemo(() => {
    const map: Record<number, ViralityAccount> = {};
    for (const c of competitors) {
      for (const a of c.accounts) {
        map[a.id] = a;
      }
    }
    return map;
  }, [competitors]);

  // Derive account statuses from real data (is_active defaults to true if missing)
  const accountStatuses = useMemo(() => {
    const map: Record<number, "active" | "inactive"> = {};
    for (const c of competitors) {
      for (const a of c.accounts) {
        map[a.id] = a.is_active === false ? "inactive" : "active";
      }
    }
    return map;
  }, [competitors]);

  // Date-filtered posts for viral/recent tabs
  const allPosts = useMemo(() => {
    return Object.values(postsByAccount).flat();
  }, [postsByAccount]);

  // Unfiltered posts for "All" tab
  const allPostsUnfiltered = useMemo(() => {
    return Object.values(allPostsByAccountUnfiltered).flat();
  }, [allPostsByAccountUnfiltered]);

  /** Most recent sync timestamp across all accounts */
  const competitorCards = useMemo(() => {
    return competitors.map((comp) => {
      const posts = comp.accounts.flatMap((a) => postsByAccount[a.id] || []);
      const followers = comp.accounts.reduce((s, a) => s + (a.follower_count || 0), 0);
      const totalViews = posts.reduce((s, p) => s + (p.video_play_count || 0), 0);
      const totalLikes = posts.reduce((s, p) => s + (p.like_count || 0), 0);
      const totalComments = posts.reduce((s, p) => s + (p.comment_count || 0), 0);
      const engRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
      const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;

      const postsPerWeek = computePostsPerWeek(posts);

      // Compute changes from metrics_history (last two entries)
      let prevLikes = 0, prevComments = 0, prevViews = 0;
      let latestLikes = 0, latestComments = 0, latestViews = 0;
      let prevFollowers = 0, latestFollowers = 0;
      let hasHistory = false, hasFollowerHistory = false;

      for (const post of posts) {
        const h = post.metrics_history;
        if (!h || h.length < 2) continue;
        hasHistory = true;
        const prev = h[h.length - 2];
        const latest = h[h.length - 1];
        prevLikes += prev.likes;
        prevComments += prev.comments;
        prevViews += prev.views ?? 0;
        latestLikes += latest.likes;
        latestComments += latest.comments;
        latestViews += latest.views ?? 0;
      }

      for (const a of comp.accounts) {
        const fh = a.follower_history;
        if (!fh || fh.length < 2) continue;
        hasFollowerHistory = true;
        prevFollowers += fh[fh.length - 2].followers;
        latestFollowers += fh[fh.length - 1].followers;
      }

      const followersChange = hasFollowerHistory ? pct(latestFollowers, prevFollowers) : null;
      const viewsChange = hasHistory ? pct(latestViews, prevViews) : null;

      const prevEngRate = prevViews > 0 ? ((prevLikes + prevComments) / prevViews) * 100 : 0;
      const latestEngRate = latestViews > 0 ? ((latestLikes + latestComments) / latestViews) * 100 : 0;
      const engRateChange = hasHistory ? latestEngRate - prevEngRate : null;

      const platforms = Array.from(new Set(comp.accounts.map((a) => a.platform)));

      return { competitor: comp, followers, totalViews, engRate, avgViews, postsPerWeek, platforms, followersChange, viewsChange, engRateChange };
    });
  }, [competitors, postsByAccount]);

  const handleViewCompetitor = (competitorId: number) => {
    router.push(`/dashboard/virality/${competitorId}`);
  };

  const handleViewAccount = (competitorId: number, accountId: number) => {
    router.push(`/dashboard/virality/${competitorId}?accountId=${accountId}`);
  };

  const handleDeleteAccount = async (accountId: number) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.deleteAccount(selectedTeam.id, accountId);
      addToast({ title: "Account deleted", color: "success" });
      await fetchData();
    } catch (err: any) {
      addToast({ title: "Failed to delete account", description: err.message, color: "danger" });
    }
  };

  const handleToggleAccountStatus = async (accountId: number, newStatus: "active" | "inactive") => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.updateAccountStatus(selectedTeam.id, accountId, newStatus === "active");
      // Update local state only — no need to refetch everything
      setCompetitors((prev) =>
        prev.map((c) => ({
          ...c,
          accounts: c.accounts.map((a) =>
            a.id === accountId ? { ...a, is_active: newStatus === "active" } : a
          ),
        }))
      );
      addToast({
        title: `Account ${newStatus === "active" ? "activated" : "deactivated"}`,
        color: "success",
      });
    } catch (err: any) {
      addToast({ title: "Failed to update status", description: err.message, color: "danger" });
    }
  };

  const handleSaveCompetitorName = async (competitorId: number) => {
    if (!selectedTeam?.id || !editingName.trim()) return;
    try {
      await viralityAPI.updateCompetitor(selectedTeam.id, competitorId, { name: editingName.trim() });
      setCompetitors((prev) =>
        prev.map((c) => c.id === competitorId ? { ...c, name: editingName.trim() } : c)
      );
      setSimpleCompetitors((prev) =>
        prev.map((c) => c.id === competitorId ? { ...c, name: editingName.trim() } : c)
      );
      setEditingCompetitorId(null);
      addToast({ title: "Competitor renamed", color: "success" });
    } catch (err: any) {
      addToast({ title: "Failed to rename competitor", description: err.message, color: "danger" });
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

    let competitorId = options.competitorId;

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
      platform,
      profileUrl,
      competitorId,
      options.accountType
    );

    addToast({ title: "Account added", color: "success" });
    await fetchData();
  };

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-surface-dark p-6 lg:p-8 overflow-x-hidden"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Tracked Competitors
            </h1>
            <p className="text-text-secondary text-sm mt-1">
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

        {/* Competitor Cards */}
        <RecalcOverlay active={isRecalculating}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {competitorCards.map((card, idx) => (
              <CompetitorCard
                key={card.competitor.id}
                {...card}
                index={idx}
                isExpanded={cardsExpanded}
                onToggleExpand={() => setCardsExpanded((v) => !v)}
                postsByAccount={postsByAccount}
                editingCompetitorId={editingCompetitorId}
                editingName={editingName}
                onEditStart={(id, name) => { setEditingName(name); setEditingCompetitorId(id); }}
                onEditNameChange={setEditingName}
                onEditSave={handleSaveCompetitorName}
                onEditCancel={() => setEditingCompetitorId(null)}
                onViewCompetitor={handleViewCompetitor}
              />
            ))}
          </div>
        </RecalcOverlay>

        {/* Head-to-Head Comparison */}
        {competitorCards.length > 1 && (
          <RecalcOverlay active={isRecalculating}>
            <HeadToHeadTable
              competitors={competitorCards.map(({ competitor, followers, totalViews, engRate, avgViews, postsPerWeek }) => ({
                name: competitor.name,
                followers,
                totalViews,
                totalPosts: competitor.accounts.reduce((s, a) => s + (dashboardStats?.accountPostStats?.[a.id]?.postCount || 0), 0),
                engRate,
                postsPerWeek,
                avgViews,
              }))}
            />
          </RecalcOverlay>
        )}

        {/* Accounts Table + Top Performing Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Accounts Table (2/3 width on xl+ screens) */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <PlatformFilter
                selected={platformFilter}
                onChange={setPlatformFilter}
              />
              <Input
                placeholder="Search accounts..."
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
                  base: "w-60",
                  inputWrapper: "bg-surface-base border-border-base",
                }}
              />
            </div>
            <RecalcOverlay active={isRecalculating}>
              <AccountsTable
                competitors={competitors}
                platformFilter={platformFilter}
                searchQuery={searchQuery}
                accountPostStats={dashboardStats?.accountPostStats}
                onViewCompetitor={handleViewCompetitor}
                onViewAccount={handleViewAccount}
                onDeleteAccount={handleDeleteAccount}
                onToggleAccountStatus={handleToggleAccountStatus}
                accountStatuses={accountStatuses}
              />
            </RecalcOverlay>
          </div>

          {/* Top Performing Content (1/3 width on xl+ screens) */}
          <div className="xl:col-span-1">
            <RecalcOverlay active={isRecalculating}>
              <ActivityFeed
                posts={allPosts}
                allPosts={allPostsUnfiltered}
                accountMap={accountMap}
                dateRange={dateRange}
              />
            </RecalcOverlay>
          </div>
        </div>
      </div>

      <AddAccountModal
        isOpen={isOpen}
        onClose={onClose}
        competitors={simpleCompetitors}
        onSubmit={handleAddAccount}
      />
    </motion.div>
  );
}
