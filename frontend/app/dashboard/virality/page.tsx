"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button, Input, useOverlayState, Spinner } from "@heroui/react";
import { toast } from "@/lib/toast";
import { Icon } from "@iconify/react";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  AccountsTable,
  PlatformFilter,
  AddAccountModal,
  DateRangeFilter,
  ActivityFeed,
  RecalcOverlay,
} from "@/components/virality";
import { ViralSettingsModal } from "@/components/virality/ViralSettingsModal";
import { CompetitorCard, ViralityUpgradeWall } from "@clipper/shared-ui";
import { useTeams } from "@/hooks/useTeams";
import { HeadToHeadTable } from "@clipper/shared-ui";
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
import {
  pct,
  computePostsPerWeek,
  toFeedPosts,
} from "@/app/dashboard/virality/[competitorId]/utils";
import { canAccessViralityTracker, getViralityAccountLimit, isAnalyticsPlan } from "@/lib/plans";
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
  const [platformFilter, setPlatformFilter] = useState<import("@clipper/shared-ui").PlatformOption>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();
  const {
    isOpen: isSettingsOpen,
    open: onSettingsOpen,
    close: onSettingsClose,
  } = useOverlayState();
  const [viralSettings, setViralSettings] = useState<ViralSettings | null>(
    null,
  );
  const [competitors, setCompetitors] = useState<CompetitorWithAccounts[]>([]);
  const [simpleCompetitors, setSimpleCompetitors] = useState<
    ViralityCompetitor[]
  >([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null,
  );
  const [postsByAccount, setPostsByAccount] = useState<
    Record<number, ViralityPost[]>
  >({});
  const [allPostsByAccountUnfiltered, setAllPostsByAccountUnfiltered] =
    useState<Record<number, ViralityPost[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const initialLoadDone = useRef(false);

  // My Performance state
  const [myAccounts, setMyAccounts] = useState<ViralityAccount[]>([]);
  const [myPostsByAccount, setMyPostsByAccount] = useState<
    Record<number, ViralityPost[]>
  >({});
  const [myDashboardStats, setMyDashboardStats] =
    useState<DashboardStats | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedTeam?.id || !canAccessViralityTracker(selectedTeam.plan))
      return;
    if (initialLoadDone.current) setIsRecalculating(true);
    try {
      const { startDate, endDate } = dateRange;

      // Fetch competitor data + My Performance data in parallel
      const [competitorsList, stats, myAccts, myStats] = await Promise.all([
        viralityAPI.getCompetitors(selectedTeam.id),
        viralityAPI.getDashboardStats(selectedTeam.id, startDate, endDate),
        userPerformanceAPI.getAccounts(selectedTeam.id),
        userPerformanceAPI.getDashboardStats(
          selectedTeam.id,
          startDate,
          endDate,
        ),
      ]);

      setSimpleCompetitors(competitorsList);
      setDashboardStats(stats);
      setMyAccounts(myAccts);
      setMyDashboardStats(myStats);

      const withAccounts: CompetitorWithAccounts[] = await Promise.all(
        competitorsList.map((c) =>
          viralityAPI.getCompetitor(selectedTeam.id, c.id),
        ),
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
          const filtered = viralityAPI
            .getAccountPosts(selectedTeam.id, a.id, 50, 0, startDate, endDate)
            .then((posts) => {
              postsMap[a.id] = posts;
            });

          if (hasDateFilter) {
            const unfiltered = viralityAPI
              .getAccountPosts(selectedTeam.id, a.id, 100, 0)
              .then((posts) => {
                unfilteredMap[a.id] = posts;
              });
            return [filtered, unfiltered];
          }
          return [filtered];
        }),
        // My Performance account posts (stored with negative IDs)
        ...myAccts.flatMap((a) => {
          const negId = toMyPerfId(a.id);
          const filtered = userPerformanceAPI
            .getAccountPosts(selectedTeam.id, a.id, 50, 0, startDate, endDate)
            .then((posts) => {
              postsMap[negId] = posts.map((p) => ({ ...p, account_id: negId }));
            });

          if (hasDateFilter) {
            const unfiltered = userPerformanceAPI
              .getAccountPosts(selectedTeam.id, a.id, 100, 0)
              .then((posts) => {
                unfilteredMap[negId] = posts.map((p) => ({
                  ...p,
                  account_id: negId,
                }));
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

  // Merged accountPostStats (competitor stats + My Performance stats with negative IDs)
  const mergedAccountPostStats = useMemo(() => {
    const merged: Record<number, { postCount: number; totalViews: number }> = {
      ...dashboardStats?.accountPostStats,
    };
    if (myDashboardStats?.accountPostStats) {
      for (const [idStr, stats] of Object.entries(
        myDashboardStats.accountPostStats,
      )) {
        merged[toMyPerfId(Number(idStr))] = stats;
      }
    }
    return merged;
  }, [dashboardStats, myDashboardStats]);

  const accountRows = useMemo(() => {
    const rows: import("@clipper/shared-ui").AccountRow[] = [];
    for (const c of allCompetitors) {
      for (const a of c.accounts) {
        const stats = mergedAccountPostStats[a.id];
        const views = stats?.totalViews || 0;
        const postCount = stats?.postCount || 0;
        rows.push({
          id: a.id,
          username: a.username,
          displayName: a.display_name || "",
          platform: a.platform,
          accountType: a.account_type as "profile" | "hashtag" | "keyword",
          competitorName: c.name,
          competitorId: c.id,
          views,
          avgViews: postCount > 0 ? Math.round(views / postCount) : 0,
          postCount,
          isActive: a.is_active !== false,
          alertEnabled: !!a.alert_enabled,
        });
      }
    }
    return rows;
  }, [allCompetitors, mergedAccountPostStats]);

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
      const followers = comp.accounts.reduce(
        (s, a) => s + (a.follower_count || 0),
        0,
      );
      const totalViews = posts.reduce(
        (s, p) => s + (p.video_play_count || 0),
        0,
      );
      const totalLikes = posts.reduce((s, p) => s + (p.like_count || 0), 0);
      const totalComments = posts.reduce(
        (s, p) => s + (p.comment_count || 0),
        0,
      );
      const engRate =
        totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;
      const avgViews =
        posts.length > 0 ? Math.round(totalViews / posts.length) : 0;

      const postsPerWeek = computePostsPerWeek(posts);

      // Compute changes from metrics_history (last two entries)
      let prevLikes = 0,
        prevComments = 0,
        prevViews = 0;
      let latestLikes = 0,
        latestComments = 0,
        latestViews = 0;
      let prevFollowers = 0,
        latestFollowers = 0;
      let hasHistory = false,
        hasFollowerHistory = false;

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

      const followersChange = hasFollowerHistory
        ? pct(latestFollowers, prevFollowers)
        : null;
      const viewsChange = hasHistory ? pct(latestViews, prevViews) : null;

      const prevEngRate =
        prevViews > 0 ? ((prevLikes + prevComments) / prevViews) * 100 : 0;
      const latestEngRate =
        latestViews > 0
          ? ((latestLikes + latestComments) / latestViews) * 100
          : 0;
      const engRateChange = hasHistory ? latestEngRate - prevEngRate : null;

      const platforms = Array.from(
        new Set(comp.accounts.map((a) => a.platform)),
      );

      return {
        competitor: comp,
        followers,
        totalViews,
        engRate,
        avgViews,
        postsPerWeek,
        platforms,
        followersChange,
        viewsChange,
        engRateChange,
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
        await userPerformanceAPI.deleteAccount(
          selectedTeam.id,
          fromMyPerfId(accountId),
        );
      } else {
        await viralityAPI.deleteAccount(selectedTeam.id, accountId);
      }
      toast({ title: "Account deleted", color: "success" });
      await fetchData();
    } catch (err: any) {
      toast({
        title: "Failed to delete account",
        description: err.message,
        color: "danger",
      });
    }
  };

  const handleToggleAccountStatus = async (
    accountId: number,
    newStatus: "active" | "inactive",
  ) => {
    if (!selectedTeam?.id) return;

    if (newStatus === "active") {
      const limit = getViralityAccountLimit(selectedTeam.plan);
      const activeCount = accountRows.filter((a) => a.isActive).length;
      if (limit !== -1 && activeCount >= limit) {
        toast({
          title: "Account limit reached",
          description: `Your plan allows ${limit} active accounts.`,
          color: "danger",
        });
        return;
      }
    }

    const isActive = newStatus === "active";
    if (isMyPerfId(accountId)) {
      setMyAccounts((prev) =>
        prev.map((a) =>
          a.id === fromMyPerfId(accountId) ? { ...a, is_active: isActive } : a,
        ),
      );
      userPerformanceAPI
        .updateAccountStatus(selectedTeam.id, fromMyPerfId(accountId), isActive)
        .catch((err) => {
          setMyAccounts((prev) =>
            prev.map((a) =>
              a.id === fromMyPerfId(accountId) ? { ...a, is_active: !isActive } : a,
            ),
          );
          toast({ title: "Failed to update status", description: err.message, color: "danger" });
        });
    } else {
      setCompetitors((prev) =>
        prev.map((c) => ({
          ...c,
          accounts: c.accounts.map((a) =>
            a.id === accountId ? { ...a, is_active: isActive } : a,
          ),
        })),
      );
      viralityAPI
        .updateAccountStatus(selectedTeam.id, accountId, isActive)
        .catch((err) => {
          setCompetitors((prev) =>
            prev.map((c) => ({
              ...c,
              accounts: c.accounts.map((a) =>
                a.id === accountId ? { ...a, is_active: !isActive } : a,
              ),
            })),
          );
          toast({ title: "Failed to update status", description: err.message, color: "danger" });
        });
    }
  };

  const handleActivateAll = async () => {
    if (!selectedTeam?.id) return;
    const limit = getViralityAccountLimit(selectedTeam.plan);
    const inactiveAccounts = accountRows.filter((a) => !a.isActive);
    if (inactiveAccounts.length === 0) return;

    const activeCount = accountRows.filter((a) => a.isActive).length;
    const slots = limit === -1 ? inactiveAccounts.length : Math.max(0, limit - activeCount);
    if (slots === 0) {
      toast({
        title: "Account limit reached",
        description: `Your plan allows ${limit} active accounts.`,
        color: "danger",
      });
      return;
    }

    const toActivate = inactiveAccounts.slice(0, slots);
    const toActivateIds = new Set(toActivate.map((a) => a.id));
    const skipped = inactiveAccounts.length - toActivate.length;

    setMyAccounts((prev) =>
      prev.map((a) => toActivateIds.has(toMyPerfId(a.id)) ? { ...a, is_active: true } : a),
    );
    setCompetitors((prev) =>
      prev.map((c) => ({
        ...c,
        accounts: c.accounts.map((a) => toActivateIds.has(a.id) ? { ...a, is_active: true } : a),
      })),
    );

    const description = skipped > 0
      ? `${toActivate.length} activated, ${skipped} skipped (plan limit: ${limit})`
      : `${toActivate.length} accounts activated`;
    toast({ title: "Accounts activated", description, color: "success" });

    try {
      await Promise.all(
        toActivate.map((a) =>
          isMyPerfId(a.id)
            ? userPerformanceAPI.updateAccountStatus(selectedTeam.id, fromMyPerfId(a.id), true)
            : viralityAPI.updateAccountStatus(selectedTeam.id, a.id, true)
        ),
      );
    } catch (err: any) {
      toast({ title: "Some accounts failed to activate", description: err.message, color: "danger" });
      await fetchData();
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
    },
  ) => {
    if (!selectedTeam?.id) return;

    // Route to userPerformance API if My Performance is selected
    if (options.isMyPerformance) {
      await userPerformanceAPI.addAccount(
        selectedTeam.id,
        platform,
        profileUrl,
        options.accountType,
      );
      toast({ title: "Account added to My Performance", color: "success" });
      await fetchData();
      return;
    }

    let competitorId = options.competitorId;

    if (!competitorId && options.newCompetitorName) {
      const competitor = await viralityAPI.createCompetitor(
        selectedTeam.id,
        options.newCompetitorName,
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
      options.accountType,
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
    setCompetitors((prev) =>
      prev.map((c) => ({
        ...c,
        accounts: c.accounts.map((a) =>
          a.id === accountId ? { ...a, alert_enabled: enabled } : a,
        ),
      })),
    );
    viralityAPI.updateAlertEnabled(selectedTeam.id, accountId, enabled).catch((err) => {
      setCompetitors((prev) =>
        prev.map((c) => ({
          ...c,
          accounts: c.accounts.map((a) =>
            a.id === accountId ? { ...a, alert_enabled: !enabled } : a,
          ),
        })),
      );
      toast({ title: "Failed to update alerts", description: err.message, color: "danger" });
    });
  };

  const handleOpenSettings = async () => {
    if (!selectedTeam?.id) return;
    try {
      const settings = await viralityAPI.getSettings(selectedTeam.id);
      setViralSettings(settings);
      onSettingsOpen();
    } catch (err: any) {
      toast({
        title: "Failed to load settings",
        description: err.message,
        color: "danger",
      });
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
      toast({
        title: "Failed to save settings",
        description: err.message,
        color: "danger",
      });
    }
  };

  if (!canAccessViralityTracker(selectedTeam?.plan)) {
    return <ViralityUpgradeWall />;
  }

  if (isLoading) {
    return <PageLoader />;
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
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Tracked Competitors
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                Real-time performance metrics for your monitored competitors
              </p>
            </div>
            {(() => {
              const limit = getViralityAccountLimit(selectedTeam?.plan);
              if (limit === -1) return null;
              const count = accountRows.length;
              const pctUsed = limit > 0 ? (count / limit) * 100 : 100;
              const color = pctUsed >= 100 ? "text-red-400" : pctUsed >= 80 ? "text-yellow-400" : "text-text-secondary";
              return (
                <span className={`text-sm font-medium ${color} whitespace-nowrap`}>
                  {count} / {limit} accounts
                </span>
              );
            })()}
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
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-600"
              onPress={onOpen}
              isDisabled={(() => {
                const limit = getViralityAccountLimit(selectedTeam?.plan);
                return limit !== -1 && accountRows.length >= limit;
              })()}
            >
              <Icon icon="solar:add-circle-bold" width={16} />
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
                data={{
                  id: card.competitor.id,
                  name: card.competitor.name,
                  accountCount: card.competitor.accounts.length,
                  followers: card.followers,
                  totalViews: card.totalViews,
                  engRate: card.engRate,
                  avgViews: card.avgViews,
                  platforms: card.platforms,
                  followersChange: card.followersChange,
                  viewsChange: card.viewsChange,
                  engRateChange: card.engRateChange,
                  isMyPerformance: card.isMyPerformance,
                }}
                index={idx}
                onView={handleViewCompetitor}
              />
            ))}
          </div>
        </RecalcOverlay>

        {/* Head-to-Head Comparison */}
        {competitorCards.length > 1 && (
          <RecalcOverlay active={isRecalculating}>
            <HeadToHeadTable
              competitors={competitorCards.map(
                ({
                  competitor,
                  followers,
                  totalViews,
                  engRate,
                  avgViews,
                  postsPerWeek,
                }) => ({
                  name: competitor.name,
                  followers,
                  totalViews,
                  totalPosts: competitor.accounts.reduce(
                    (s, a) =>
                      s + (mergedAccountPostStats[a.id]?.postCount || 0),
                    0,
                  ),
                  engRate,
                  postsPerWeek,
                  avgViews,
                }),
              )}
            />
          </RecalcOverlay>
        )}

        {/* Accounts Table + Top Performing Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Accounts Table (2/3 width on xl+ screens) */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <PlatformFilter
                value={platformFilter}
                onChange={setPlatformFilter}
              />
              <div className="relative w-60">
                <Icon
                  icon="solar:magnifer-linear"
                  width={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                />
                <Input
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <RecalcOverlay active={isRecalculating}>
              <AccountsTable
                accounts={accountRows}
                platformFilter={platformFilter}
                searchQuery={searchQuery}
                accountLimit={getViralityAccountLimit(selectedTeam?.plan)}
                onRowClick={(row) => handleViewAccount(row.competitorId, row.id)}
                onDelete={handleDeleteAccount}
                onToggleStatus={handleToggleAccountStatus}
                onToggleAlert={handleToggleAlert}
                onActivateAll={handleActivateAll}
              />
            </RecalcOverlay>
          </div>

          {/* Top Performing Content (1/3 width on xl+ screens) */}
          <div className="xl:col-span-1">
            <RecalcOverlay active={isRecalculating}>
              <ActivityFeed
                posts={toFeedPosts(allPosts, accountMap, dateRange.startDate, dateRange.endDate)}
                allPosts={toFeedPosts(allPostsUnfiltered, accountMap)}
                hasDateRange={!!(dateRange.startDate || dateRange.endDate)}
                maxItems={10}
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
        accountCount={accountRows.length}
        accountLimit={getViralityAccountLimit(selectedTeam?.plan)}
        plan={selectedTeam?.plan}
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
