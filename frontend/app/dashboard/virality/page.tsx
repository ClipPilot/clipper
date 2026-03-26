"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, useOverlayState, Spinner } from "@heroui/react";
import { toast } from "@/lib/toast";
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
import { ViralSettingsModal } from "@/components/virality/ViralSettingsModal";
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
  type ViralSettings,
} from "@/api/virality";
import { userPerformanceAPI } from "@/api/userPerformance";
import { pct, computePostsPerWeek } from "@/app/dashboard/virality/[competitorId]/utils";
import { canAccessViralityTracker } from "@/lib/plans";
import {
  MY_PERFORMANCE_NAME,
  MY_PERFORMANCE_COMPETITOR_ID,
  toMyPerfId,
  fromMyPerfId,
  isMyPerfId,
} from "@/lib/viralityConstants";

export default function ViralityPage() {
  const router = useRouter();
  const { selectedTeam } = useTeams();
  const { dateRange, setDateRange } = useViralityDateRange();
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();
  const { isOpen: isSettingsOpen, open: onSettingsOpen, close: onSettingsClose } = useOverlayState();
  const [viralSettings, setViralSettings] = useState<ViralSettings | null>(null);
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

  // My Performance state
  const [myAccounts, setMyAccounts] = useState<ViralityAccount[]>([]);
  const [myPostsByAccount, setMyPostsByAccount] = useState<Record<number, ViralityPost[]>>({});
  const [myDashboardStats, setMyDashboardStats] = useState<DashboardStats | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan)) return;
    if (initialLoadDone.current) setIsRecalculating(true);
    try {
      const { startDate, endDate } = dateRange;

      // Fetch competitor data + My Performance data in parallel
      const [competitorsList, stats, myAccts, myStats] = await Promise.all([
        viralityAPI.getCompetitors(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getAccounts(selectedTeam.id),
        userPerformanceAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
      ]);

      setSimpleCompetitors(competitorsList);
      setDashboardStats(stats);
      setMyAccounts(myAccts);
      setMyDashboardStats(myStats);

      const withAccounts: CompetitorWithAccounts[] = await Promise.all(
        competitorsList.map((c) =>
          viralityAPI.getCompetitor(selectedTeam.id, c.id)
        )
      );
      setCompetitors(withAccounts);

      // Fetch posts for all competitor accounts (filtered + unfiltered for top content)
      const allCompAccounts = withAccounts.flatMap((c) => c.accounts);
      const postsMap: Record<number, ViralityPost[]> = {};
      const unfilteredMap: Record<number, ViralityPost[]> = {};
      const hasDateFilter = !!(startDate || endDate);

      await Promise.all([
        // Competitor account posts
        ...allCompAccounts.flatMap((a) => {
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
        }),
        // My Performance account posts (stored with negative IDs)
        ...myAccts.flatMap((a) => {
          const negId = toMyPerfId(a.id);
          const filtered = userPerformanceAPI.getAccountPosts(
            selectedTeam.id, a.id, 50, 0, startDate, endDate
          ).then((posts) => {
            postsMap[negId] = posts.map((p) => ({ ...p, account_id: negId }));
          });

          if (hasDateFilter) {
            const unfiltered = userPerformanceAPI.getAccountPosts(
              selectedTeam.id, a.id, 100, 0
            ).then((posts) => {
              unfilteredMap[negId] = posts.map((p) => ({ ...p, account_id: negId }));
            });
            return [filtered, unfiltered];
          }
          return [filtered];
        }),
      ]);

      // Also store My Performance posts under their negative IDs separately
      const myPostsMap: Record<number, ViralityPost[]> = {};
      for (const a of myAccts) {
        const negId = toMyPerfId(a.id);
        myPostsMap[negId] = postsMap[negId] || [];
      }
      setMyPostsByAccount(myPostsMap);

      setPostsByAccount(postsMap);
      setAllPostsByAccountUnfiltered(hasDateFilter ? unfilteredMap : postsMap);
    } catch (err: any) {
      toast({
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

  // ─── Virtual My Performance competitor ──────────────────────────────────────

  /** Build a virtual CompetitorWithAccounts for My Performance using negative IDs.
   *  Always present (even with 0 accounts) so the card shows as an invite. */
  const myPerformanceCompetitor = useMemo<CompetitorWithAccounts>(() => {
    const now = new Date().toISOString();
    return {
      id: MY_PERFORMANCE_COMPETITOR_ID,
      name: MY_PERFORMANCE_NAME,
      description: null,
      team_id: selectedTeam?.id ?? 0,
      created_at: now,
      updated_at: now,
      accounts: myAccounts.map((a) => ({ ...a, id: toMyPerfId(a.id) })),
    };
  }, [myAccounts, selectedTeam?.id]);

  /** All competitors including the virtual My Performance group (always first) */
  const allCompetitors = useMemo(() => {
    return [myPerformanceCompetitor, ...competitors];
  }, [myPerformanceCompetitor, competitors]);

  // Build account lookup map for Top Performing Content (includes My Perf accounts)
  const accountMap = useMemo(() => {
    const map: Record<number, ViralityAccount> = {};
    for (const c of allCompetitors) {
      for (const a of c.accounts) {
        map[a.id] = a;
      }
    }
    return map;
  }, [allCompetitors]);

  // Derive account statuses from real data (is_active defaults to true if missing)
  const accountStatuses = useMemo(() => {
    const map: Record<number, "active" | "inactive"> = {};
    for (const c of allCompetitors) {
      for (const a of c.accounts) {
        map[a.id] = a.is_active === false ? "inactive" : "active";
      }
    }
    return map;
  }, [allCompetitors]);

  // Merged accountPostStats (competitor stats + My Performance stats with negative IDs)
  const mergedAccountPostStats = useMemo(() => {
    const merged: Record<number, { postCount: number; totalViews: number }> = {
      ...dashboardStats?.accountPostStats,
    };
    if (myDashboardStats?.accountPostStats) {
      for (const [idStr, stats] of Object.entries(myDashboardStats.accountPostStats)) {
        merged[toMyPerfId(Number(idStr))] = stats;
      }
    }
    return merged;
  }, [dashboardStats, myDashboardStats]);

  // Date-filtered posts for viral/recent tabs
  const allPosts = useMemo(() => {
    return Object.values(postsByAccount).flat();
  }, [postsByAccount]);

  // Unfiltered posts for "All" tab
  const allPostsUnfiltered = useMemo(() => {
    return Object.values(allPostsByAccountUnfiltered).flat();
  }, [allPostsByAccountUnfiltered]);

  /** Compute card data for all competitors including My Performance */
  const competitorCards = useMemo(() => {
    return allCompetitors.map((comp) => {
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

      return {
        competitor: comp,
        followers, totalViews, engRate, avgViews, postsPerWeek, platforms,
        followersChange, viewsChange, engRateChange,
        isMyPerformance: comp.id === MY_PERFORMANCE_COMPETITOR_ID,
      };
    });
  }, [allCompetitors, postsByAccount]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleViewCompetitor = (competitorId: number) => {
    if (competitorId === MY_PERFORMANCE_COMPETITOR_ID) {
      router.push("/dashboard/virality/my-performance");
    } else {
      router.push(`/dashboard/virality/${competitorId}`);
    }
  };

  const handleViewAccount = (competitorId: number, accountId: number) => {
    if (competitorId === MY_PERFORMANCE_COMPETITOR_ID) {
      router.push(`/dashboard/virality/my-performance`);
    } else {
      router.push(`/dashboard/virality/${competitorId}?accountId=${accountId}`);
    }
  };

  const handleDeleteAccount = async (accountId: number) => {
    if (!selectedTeam?.id) return;
    try {
      if (isMyPerfId(accountId)) {
        await userPerformanceAPI.deleteAccount(selectedTeam.id, fromMyPerfId(accountId));
      } else {
        await viralityAPI.deleteAccount(selectedTeam.id, accountId);
      }
      toast({ title: "Account deleted", color: "success" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed to delete account", description: err.message, color: "danger" });
    }
  };

  const handleToggleAccountStatus = async (accountId: number, newStatus: "active" | "inactive") => {
    if (!selectedTeam?.id) return;
    try {
      if (isMyPerfId(accountId)) {
        await userPerformanceAPI.updateAccountStatus(selectedTeam.id, fromMyPerfId(accountId), newStatus === "active");
        // Update local state
        setMyAccounts((prev) =>
          prev.map((a) =>
            a.id === fromMyPerfId(accountId) ? { ...a, is_active: newStatus === "active" } : a
          )
        );
      } else {
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
      }
      toast({
        title: `Account ${newStatus === "active" ? "activated" : "deactivated"}`,
        color: "success",
      });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, color: "danger" });
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
      toast({ title: "Competitor renamed", color: "success" });
    } catch (err: any) {
      toast({ title: "Failed to rename competitor", description: err.message, color: "danger" });
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
      isMyPerformance?: boolean;
    }
  ) => {
    if (!selectedTeam?.id) return;

    // Route to userPerformance API if My Performance is selected
    if (options.isMyPerformance) {
      await userPerformanceAPI.addAccount(
        selectedTeam.id,
        platform,
        profileUrl,
        options.accountType
      );
      toast({ title: "Account added to My Performance", color: "success" });
      await fetchData();
      return;
    }

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

    const account = await viralityAPI.addAccount(
      selectedTeam.id,
      platform,
      profileUrl,
      competitorId,
      options.accountType
    );

    // Enable alerts on the newly created account if requested
    if (options.enableAlerts) {
      await viralityAPI.updateAlertEnabled(selectedTeam.id, account.id, true);
    }

    toast({ title: "Account added", color: "success" });
    await fetchData();
  };

  const handleToggleAlert = async (accountId: number, enabled: boolean) => {
    if (!selectedTeam?.id) return;
    try {
      await viralityAPI.updateAlertEnabled(selectedTeam.id, accountId, enabled);
      setCompetitors((prev) =>
        prev.map((c) => ({
          ...c,
          accounts: c.accounts.map((a) =>
            a.id === accountId ? { ...a, alert_enabled: enabled } : a
          ),
        }))
      );
      toast({ title: `Alerts ${enabled ? "enabled" : "disabled"}`, color: "success" });
    } catch (err: any) {
      toast({ title: "Failed to update alerts", description: err.message, color: "danger" });
    }
  };

  const handleOpenSettings = async () => {
    if (!selectedTeam?.id) return;
    try {
      const settings = await viralityAPI.getSettings(selectedTeam.id);
      setViralSettings(settings);
      onSettingsOpen();
    } catch (err: any) {
      toast({ title: "Failed to load settings", description: err.message, color: "danger" });
    }
  };

  const handleSaveSettings = async (settings: ViralSettings) => {
    if (!selectedTeam?.id) return;
    try {
      const saved = await viralityAPI.saveSettings(selectedTeam.id, settings);
      setViralSettings(saved);
      // Refresh competitors to reflect updated alert_enabled flags
      await fetchData();
      toast({ title: "Alert settings saved", color: "success" });
    } catch (err: any) {
      toast({ title: "Failed to save settings", description: err.message, color: "danger" });
    }
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
 variant="outline"
 className="border-border-base text-text-secondary"
 onPress={handleOpenSettings}
 >
              <Icon icon="solar:bell-bold" width={18} />
              Alert Settings
            </Button>
            <Button
 className="bg-accent-400 text-white"
 onPress={onOpen}
 >
              <Icon icon="solar:add-circle-bold" width={18} />
              Add Account
            </Button>
          </div>
        </div>

        {/* Competitor Cards (My Performance first, then competitors) */}
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
                isMyPerformance={card.isMyPerformance}
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
                totalPosts: competitor.accounts.reduce((s, a) => s + (mergedAccountPostStats[a.id]?.postCount || 0), 0),
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-60"
              >
                <Icon
                  icon="solar:magnifer-linear"
                  width={18}
                  className="text-text-tertiary"
                />
              </Input>
            </div>
            <RecalcOverlay active={isRecalculating}>
              <AccountsTable
                competitors={allCompetitors}
                platformFilter={platformFilter}
                searchQuery={searchQuery}
                accountPostStats={mergedAccountPostStats}
                onViewCompetitor={handleViewCompetitor}
                onViewAccount={handleViewAccount}
                onDeleteAccount={handleDeleteAccount}
                onToggleAccountStatus={handleToggleAccountStatus}
                onToggleAlert={handleToggleAlert}
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

      {viralSettings && (
        <ViralSettingsModal
          isOpen={isSettingsOpen}
          onClose={onSettingsClose}
          competitors={competitors}
          settings={viralSettings}
          onSave={handleSaveSettings}
        />
      )}
    </motion.div>
  );
}
